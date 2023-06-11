'use strict';


const {dialogflow,SignIn,Suggestions, BasicCard, Button, DialogflowConversation} = require('actions-on-google');
const {updateUserToDB,getAccessTokenFromDB,getFirstResponder} = require('./firebase');
const {getGoogleProfile,recommendExerciseVideo,convertISOtimeFormat,getEventsFromCalender,postEventToCalender,filteringEvents,EventsTTS} = require('./google');
const {getUserInformaiton,getUserActivity,decisionForRecommend,toggleSecurityMode,getUserFallingCount,checkFallingDetection} = require('./mowa');
const {getAnswer} = require('./openai');
const {sendMessage} = require('./sns');
const functions = require('firebase-functions');
require("dotenv").config();


const app = dialogflow({
    clientId: process.env.DIALOGFLOW_CLIENT_ID,
    debug: true});


const webApp = require("./express");



/**
 * Middlewate에선 사용자의 status와 mode를 우선적으로 구분합니다. statue는 Mobile, Guest, Linked, Expired가 있으며 Mode는 Conversation과 Command 모드가 있습니다.
 * 추가적으로 Fall Detection을 위해 사용자의 넘어짐 횟수 정보도 갱신합니다.
 */
app.middleware( async (conv) =>{   
  conv.data.mode= conv.data.smallTalk?"Conversation":"Command";
  const {status} = conv.data;
  if (fromAndroid(conv)===true){
    conv.data.status="mobile";
  }
  if(status === "linked"){
    const access_token=conv.user.raw.accessToken;
    let {userId} = conv.data;
    try {
      userId || await getGoogleProfile(access_token).email;
    }catch(e){
      conv.data.status="expired";
      return ;
    };
    let fall_count
    try{
      fall_count = await getUserFallingCount(id);
    } catch(e){
      return ; 
    }
    if(conv.data.fallingCount === undefined){
      conv.data.fallingCount = fall_count;
      return ;
    } 
    if(fall_count !== undefined){
       conv.data.fallingDetection = (conv.data.fallingCount < fall_count)?true:false;
       conv.data.fallingCount=fall_count;
       return ;
    }
  }
});


/**
 * 모와한테 말하기로 Dialogflow App이 시작될 때 실행되는 intent입니다. 사용자의 status를 정의하고, 
 * 사용자가 로그인 되어 있다면, 활동 정보를 토대로 운동영상을 추천해주기도 합니다.
 */
app.intent('Default Welcome Intent', async (conv) => {
  if(fromAndroid(conv)===true){
    const request=conv.request
    conv.data.status="mobile";
    return conv.add(`안녕하세요 ${request.name}님. 모와입니다.`);
  }
  const access_token=conv.user.raw.accessToken
  if(!access_token){
    conv.data.status="guest"
    conv.add("안녕하세요. 모와입니다. 현재 임시 사용자 모드입니다. 기능을 사용하기 위해 로그인을 진행 해주세요.");
    conv.add(new Suggestions("로그인"));
  }
  else{
    let profile;
    try {
      profile = await getGoogleProfile(access_token);
    }catch(e){
      conv.data.status="expired";
      return conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
    };
    conv.data.fallingDetection=false;
    conv.data.status="linked";
    conv.data.userName=profile.name;
    conv.data.userId = profile.email;
    await updateUserToDB(conv);
    conv.add(`환영합니다. ${profile.name}님. 모와입니다. `);
    if(!conv.screen){
      return;
    }
    let activityArrays;
    try {
      activityArrays=await getUserActivity(profile.email);
    } catch(e){
      return;
    };
    if(activityArrays){
      if(decisionForRecommend(activityArrays)){
        //recommand Exercise Video
        conv.add("요즘 활동이 부족하십니다. 운동 영상을 시청하시면서 따라해보시는 것을 추천합니다!");
        await recommendExerciseVideo(conv);
        }
      else{ 
        conv.add("활동을 충분히 잘하고 계십니다!");
        }
    }
    else{
      conv.add('회원님의 활동 통계 정보를 가져오는데 실패하였습니다. 현재 스피커의 구글 계정과 안드로이드 모와 앱에서 로그인한 구글 계정과 동일한지 확인해주세요');
    }
  }
});

/**
 * Account Linking Flow을 시작하는 Intent입니다.
 */
app.intent('sign in', async (conv, signin)=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      return conv.ask(new SignIn(""));
    case "expired" :
      return conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
    case "mobile" :
    case "linked" :
      conv.add("이미 로그인되어 있습니다.");
      return checkFallingDetection(conv);
  }
});


/**
 * Account Linking Flow를 동의하고, 로그인을 진행한 후 실행되는 intent입니다.
 */
app.intent('sign in - yes', async (conv,params,signin)=>{
  const access_token=conv.user.raw.accessToken;
  if(signin.status!=='OK'){
    return conv.close("오류가 발생했습니다.");
  }
  if (signin.status === 'OK' && !access_token){
    conv.data.status= "expired";
    console.log("token exchange failed.");   //테스트 중인 앱은 refresh token일지라도 7일 지나면 만료
    conv.add("로그인 세션이 만료 되었습니다. 로그아웃을 하신 후 다시 로그인 해주세요.");
    return conv.add(new Suggestions("로그아웃"));

  } 
  const profile = await getGoogleProfile(access_token);
  conv.data.status="linked";
  conv.data.fallingDetection=false;
  conv.data.userName=profile.name;
  conv.data.userId = profile.email;
  await updateUserToDB(conv);
  conv.add(`환영합니다. ${profile.name}님.`);
});

/**
 * Account Linking Flow를 시작하지 않습니다.
 */
app.intent('sign in - no',conv=>{
  conv.add('로그인을 수행하지 않습니다.');
});


app.intent('test', async conv=>{
   conv.add("테스트용 Intent입니다.");
   checkFallingDetection(conv);
});


/**
 * 사용자의 프로필을 보여줍니다.
 */
app.intent('show profile', async (conv)=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      return conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      return conv.add(new Suggestions("로그아웃"));
    case "mobile" :
      const {name, email}=conv.request;
      //활동 정보
      conv.add(`회원님의 이름은 ${name}, ID는 ${email}입니다.`);
      return checkFallingDetection(conv);
    case "linked" :
      const {userName, userId} = conv.data;
      conv.add(`회원님의 이름은 ${userName}, ID는 ${userId} 입니다.`);
      return checkFallingDetection(conv);
    }
});


/**
 * 사용자의 입력이 어떠한 intent와도 매칭되지 않을 때 실행되는 Intent입니다.
 */
app.intent('Default Fallback Intent', async (conv)=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  conv.add("오류가 발생했습니다.");
  return checkFallingDetection(conv);
});

/**
 * 사용자의 보안모드를 끕니다.
 */
app.intent('security off', async (conv)=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      return conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      return conv.add(new Suggestions("로그아웃"));
    case "mobile" :
      const m_id=conv.request.email;
      const m_information=await getUserInformaiton(m_id);
      if(await toggleSecurityMode(m_id,m_information,"False")){
        conv.add("보안 모드가 꺼졌습니다.")
      }
      else{
        conv.add("오류가 발생했습니다.")
      }
      return checkFallingDetection(conv);
    case "linked" :
      const {userId}=conv.data;
      const information=await getUserInformaiton(userId);
      if(await toggleSecurityMode(userId,information,"False")){
        conv.add("보안 모드가 꺼졌습니다.")
      }
      else{
        conv.add("오류가 발생했습니다.")
      }
      return checkFallingDetection(conv);
  }

});


/**
 * 사용자의 보안 모드를 켭니다.
 */
app.intent('security on',async (conv)=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      return conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      return conv.add(new Suggestions("로그아웃"));
    case "mobile" :
      const m_id=conv.request.email;
      const m_information=await getUserInformaiton(m_id);
      if(await toggleSecurityMode(m_id,m_information,"True")){
        conv.add("보안 모드가 켜졌습니다.")
      }
      else{
        conv.add("오류가 발생했습니다.")
      }
      return checkFallingDetection(conv);
    case "linked" :
      const {userId}=conv.data;
      const information=await getUserInformaiton(userId);
      if(await toggleSecurityMode(userId,information,"True")){
        conv.add("보안 모드가 켜졌습니다.")
      }
      else{
        conv.add("오류가 발생했습니다.")
      }
      return checkFallingDetection(conv);
  }
});

/**
 * 사용자의 Account Linking을 끕니다. refresh token까지 만료되었을 때 로그아웃이 필요합니다.
 */
app.intent('logout',  conv =>{

  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      return conv.add("로그인이 필요한 기능입니다.");
    case "mobile" :
      return conv.add("안드로이드에선 로그아웃이 필요하지 않습니다.")
    case "expired" :
    case "linked" :
      if(!conv.screen){           //raspberry pi case
        return conv.add("스피커에선 로그아웃을 진행할 수 없습니다. 해당 구글 계정의 연결된 계정 페이지에서 모와를 제거 해주시기 바랍니다.");
      }
      conv.add("로그아웃은 위 링크로 들어가 모와 앱의 접근 권한을 해제하시면 됩니다.");
      conv.data.status="guest";
      conv.data.userName=undefined;
      conv.data.userId=undefined;
      return conv.ask(new BasicCard({
        text: `로그아웃`, 
        buttons: new Button({
          title: '로그아웃',
          url: 'https://myaccount.google.com/accountlinking'
        }),
        display: 'CROPPED',
      }));
    }
  });



app.intent('MoWA', conv=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
    case "expired" :
      return conv.add("네. 안녕하세요");
    case "mobile" :
    case "linked" :
      conv.ask("네. 모와입니다. 어떻게 도와드릴까요?");
      return checkFallingDetection(conv);
  }
});


  
/**
 * 비상 상황을 전달하기 위한 intent입니다. 사용자가 온전히 로그인되어 있다면 사용자의 현재 상황을 물어봅니다.
 */
app.intent('emergency', conv=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      conv.add("로그인이 필요한 기능입니다.");
      return conv.close();
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      conv.add(new Suggestions("로그아웃"));
      return conv.close();
    case "mobile" :
    case "linked" :
      return conv.ask("현재 상황을 말씀해주세요.");
  }

});

/**
 * 사용자의 비상연락처를 DB에서 읽고, 사용자가 전달한 상황을 메세지로 전송해줍니다.
 */
app.intent('emergency - situation', async (conv,params)=>{

  const {status, mode} = conv.data;
  const firstResponder = await getFirstResponder(conv);
  if(!firstResponder){
    return conv.add("현재 비상연락처의 등록된 번호가 없습니다. 안드로이드 모와 앱에서 비상 연락처를 등록해주세요.");
  }
  switch (status) {
    case "mobile" :
      const { name:m_name}=conv.request;
      const m_situation=params.situation;
      const m_result= await sendMessage(`${m_name}님으로부터 긴급 연락이 도착했습니다.\n 현재 상황:${m_situation}`, firstResponder);
      return m_result ? conv.add("비상 연락처로 상황을 전달했습니다.") : conv.add("오류가 발생했습니다.");
      
        
    case "linked" :
      const {userName}=conv.data;
      const situation=conv.input.raw;
      const result = await sendMessage(`${userName}님으로부터 긴급 연락이 도착했습니다.\n 현재 상황:${situation}`,firstResponder)
      return result ? conv.add("비상 연락처로 상황을 전달했습니다.") : conv.add("오류가 발생했습니다.");
  }
});

/**
 * 사용자에게 운동 영상을 추천해줍니다.
 */
app.intent('recommend video', async conv=>{

  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      return conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      return conv.add(new Suggestions("로그아웃"));
    case "mobile" :
    case "linked" :
     await recommendExerciseVideo(conv);
     return checkFallingDetection(conv);

  }

});

/**
 * 사용자의 모드를 대화모드로 변경합니다.
 */
app.intent('small talk mode', async conv =>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      return conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      return conv.add(new Suggestions("로그아웃"));
    case "mobile" :
    case "linked" :
      conv.data.smallTalk=true;
      console.log("대화모드 변경");
      conv.add("대화 모드로 변경합니다.");
      return checkFallingDetection(conv);

  }
});


/**
 * 사용자의 모드를 명령 모드로 변경합니다.
 */
app.intent('command mode', conv =>{
  const {status, mode} = conv.data;
  switch (status) {
    case "guest" :
    case "expired" :
    case "mobile" :
    case "linked" :
      if (mode==="Command"){
        return conv.add("이미 명령 모드입니다.")
      }
      conv.data.smallTalk=undefined;
      conv.add("명령 모드로 변경합니다.");
      return checkFallingDetection(conv);

  }
});

/**
 * 구글 캘린더에 일정을 등록하기 위한 인텐트를 실행합니다. 사용자가 로그인되어 있다면, 어떤 일정을 추가할지 물어봅니다.
 */
app.intent('reservation event', conv=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      conv.add("로그인이 필요한 기능입니다.");
      return conv.close();
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      conv.add(new Suggestions("로그아웃"));
      return conv.close();
    case "mobile" :
    case "linked" :
      return conv.add("어떤 일정을 추가하시겠습니까?");
  }
   
});

/**
 * 사용자가 일정 명을 알려주면, 등록하기 위한 시간을 물어봅니다.
 */
app.intent('reservation event - name', (conv, params)=>{
    conv.data.todo=params.todo;
    conv.add("알겠습니다. 일정을 예약할 시간의 년, 월, 일, 시, 분을 포함하여 말해주세요. 시각은 반드시 필요하며 이를 제외한 요소들은 생략 시 현재 시점을 기준으로 설정됩니다. ");
});

/**
 * 사용자가 시간을 정상적으로 입력한다면 구글 캘린더에 일정을 등록합니다.
 */
app.intent('reservation event - time', async (conv, params)=>{
  if(!params.time.includes("시")){
    return conv.add("일정을 예약할 시각 정보를 받지 못했습니다. 다시 예약해주세요.");
  }
  const {status} = conv.data;
  let access_token, userId;
  if(status === "mobile"){
      access_token = await getAccessTokenFromDB(conv);
      userId = conv.request.email;
  }
  else{
    access_token=conv.user.raw.accessToken;
    userId = conv.data.userId;
  }
  
    
  const {todo}=conv.data;
  console.log("todo:",todo);
  const startTime = await convertISOtimeFormat(params.time);

  let now=new Date();
  now=new Date(now.getTime()+540*60000);
  let start=new Date(startTime);
  if(now.getTime()>start.getTime()){
    return conv.add("이미 지난 시간에 일정을 추가할 수 없습니다.");
  }
  
  let result= await postEventToCalender(access_token, userId, todo , startTime);
  if(result){
    conv.data.toDo=undefined;
    return conv.add(`일정을 예약하였습니다.`);
  }
  conv.add("오류가 발생했습니다.");
});



/**
 * 대화모드 일 때, 사용자의 질문에 대한 chatGPT의 답변을 전달합니다.
 */
app.intent('chatGPT',async (conv, params)=>{
  const {status, mode} = conv.data;
  if(mode!=="Conversation") return conv.add("명령을 이해하지 못했어요.");
  if(params.question.includes("명령")) return conv.followup('command mode');
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      conv.add(new Suggestions("로그아웃"));
    case "mobile" :
    case "linked" :
      const answer = await getAnswer(conv, params.question);
      conv.add(`${answer}`);
      return checkFallingDetection(conv);

  }
});


/**
 * 구글 캘린더에 등록된 일정들 중 일주일 이내의 일정들을 가져와 가까운 순서대로 불러줍니다.
 */
app.intent('upcoming events', async (conv)=>{
  const {status, mode} = conv.data;
  if(mode!=="Command") return conv.add("명령을 이해하지 못했어요.");
  switch (status) {
    case "guest" :
      conv.add(new Suggestions("로그인"));    
      conv.add("로그인이 필요한 기능입니다.");
    case "expired" :
      conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
      conv.add(new Suggestions("로그아웃"));
    case "mobile" :
    case "linked" :
      let access_token,userId;
      if(status==="mobile"){
        access_token = await getAccessTokenFromDB(conv);
        userId=conv.request.email;
      }
      else{
        access_token=conv.user.raw.accessToken;
        userId=conv.data.userId
      }
      let events = await getEventsFromCalender(access_token,userId);
      let upcomingEvents= await filteringEvents(events)
      if(upcomingEvents.length === 0) {
        return conv.add("일주일 안으로 다가오는 일정이 없습니다.");
      }
      conv.add("다가오는 일정은 다음과 같습니다. \n");
      const tts=await EventsTTS(upcomingEvents);
      conv.add(`${tts}`);
      return checkFallingDetection(conv);
    }
});

/**
 * fall count가 증가되었을 때 사용자에게 괜찮은지 물어봅니다.
 */
app.intent('detect falling event', (conv) => {
  conv.add("넘어짐이 감지되었습니다. 괜찮으십니까?");
});

/**
 * 사용자가 괜찮다고 답하면 추가적인 작업을 하지 않습니다.
 */
app.intent('detect falling event - yes', (conv) => {
  conv.add("괜찮으시다니 다행입니다.");
});


/**
 * 사용자가 괜찮지 않다고 답하면 긴급 연락처를 통해 사용자가 넘어졌음을 메세지로 전송합니다.
 */
app.intent('detect falling event - no', async (conv) => {
  const {userName} = conv.data;
  const firstResponder = await getFirstResponder(conv);
  if(firstResponder){
    const result = await sendMessage(`${userName}님이 넘어졌습니다.`, firstResponder);
    return result?conv.add("알겠습니다. 상황이 좋지 않아 비상 연락처를 통해 메세지를 전송하겠습니다."):conv.add("오류가 발생했습니다.");
  }
  conv.add("현재 비상연락처의 등록된 번호가 없습니다. 안드로이드 모와 앱에서 비상 연락처를 등록해주세요.");
});



/**
 * 사용자의 요청이 안드로이드 MoWA App으로부터 온 것인지 확인합니다.
 * @param {DialogflowConversation} conv 
 * @returns {Boolean}
 */
function fromAndroid(conv){
  if (conv.request.from=="AndroidMoWA"){
    console.log(conv.request);
    return true;
  }
  else return false;
}

exports.fulfillmentExpressServer=functions.https.onRequest(webApp);
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);