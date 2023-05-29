'use strict';


const {dialogflow,SignIn,Suggestions, BasicCard, Button, Image, Conversation} = require('actions-on-google');
const {Configuration, OpenAIApi} = require('openai');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const request = require('request-promise-native');
const CryptoJS = require('crypto-js');
require("dotenv").config();

const mowaURL=process.env.MOWA_URL;
const RecommendThreshhold=10;

const configuration=new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai=new OpenAIApi(configuration);

const app = dialogflow({
    clientId: process.env.DIALOGFLOW_CLIENT_ID,
    debug: true});

const webApp = require("./express");
const { log } = require('firebase-functions/logger');







app.middleware( (conv) =>{   
  conv.data.mode= conv.data.smallTalk?"Conversation":"Command";
  if (fromAndroid(conv)===true){
    conv.data.status="mobile";
  }
});


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
      //토큰 만료. 
      conv.data.status="expired";
      return conv.add("현재 로그인 세션이 만료되었습니다. 로그아웃 해주세요.");
    };
    conv.data.status="linked";
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
      return conv.add("이미 로그인되어 있습니다.");
  }

});

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
  conv.add(`환영합니다. ${profile.name}님.`);
});

app.intent('sign in - no',conv=>{
  conv.add('로그인을 수행하지 않습니다.');
});

app.intent('test', async conv=>{
  const {status, mode} = conv.data;


  /*const result = await openai.createChatCompletion({
    model : "gpt-3.5-turbo",
    messages : [{
      role : "user",
      content : "Hello" 
    }]
  });*/
  const result = await getAnswer(conv,"hello");
  return conv.add(`${result}`);
  

  //const test= await translate("en","ko",await getRespondeFromOpenAI("I have a headache."));
  //console.log("test:",test);
  //conv.add(`테스트 성공, ${test}`);
});




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
      const request=conv.request;
      return conv.add(`회원님의 이름은 ${request.name}, 이메일은 ${request.email}입니다.`);
    case "linked" :
      const access_token=conv.user.raw.accessToken;
      const profile = await getGoogleProfile(access_token);
      return conv.add(`회원님의 이름은 ${profile.name}, 이메일은 ${profile.email} 입니다.`);
  }
});



app.intent('Default Fallback Intent', async (conv)=>{
  const {status, mode} = conv.data;
  if(mode==="Conversation") return conv.followup('chatGPT');
  conv.add("오류가 발생했습니다.");
});


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
        return conv.add("보안 모드가 꺼졌습니다.")
      }
      else{
        return conv.add("오류가 발생했습니다.")
      }
    case "linked" :
      const access_token=conv.user.raw.accessToken;
      const profile = await getGoogleProfile(access_token);
      const id=profile.email;
      const information=await getUserInformaiton(id);
      if(await toggleSecurityMode(id,information,"False")){
        return conv.add("보안 모드가 꺼졌습니다.")
      }
      else{
        return conv.add("오류가 발생했습니다.")
      }
  }

});


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
        return conv.add("보안 모드가 켜졌습니다.")
      }
      else{
        return conv.add("오류가 발생했습니다.")
      }
    case "linked" :
      const access_token=conv.user.raw.accessToken;
      const profile = await getGoogleProfile(access_token);
      const id=profile.email;
      const information=await getUserInformaiton(id);
      if(await toggleSecurityMode(id,information,"True")){
        return conv.add("보안 모드가 켜졌습니다.")
      }
      else{
        return conv.add("오류가 발생했습니다.")
      }
  }
});

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

app.intent('emergency - situation', async (conv,params)=>{

  const {status, mode} = conv.data;
  switch (status) {
    case "mobile" :
      const m_name=conv.request.name;
      const m_situation=params.situation;
      return await sendMessage(conv,m_name,m_situation)
    case "linked" :
      const access_token=conv.user.raw.accessToken;
      const profile = await getGoogleProfile(access_token);
      const name=profile.name;
      const situation=conv.input.raw;
      return await sendMessage(conv,name,situation)
  }
});

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
     return await recommendExerciseVideo(conv);

  }

});

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
      return conv.add("대화 모드로 변경합니다.")
  }
});



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
  }
});

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
      conv.add("아직 모바일에선 불가능합니다.");
      return conv.close();
    case "linked" :
      return conv.add("어떤 일정을 추가하시겠습니까?");
  }
   
});

app.intent('reservation event - name', (conv, params)=>{
    console.log("params test:",params);   //params.todo
    conv.data.todo=params.todo;
    conv.add("알겠습니다. 일정을 예약할 시간의 년, 월, 일, 시, 분을 포함하여 말해주십시오. 시각은 반드시 필요하며 이를 제외한 요소들은 생략 시 현재 시점을 기준으로 설정됩니다. ");
});

app.intent('reservation event - time', async (conv, params)=>{
  if(!params.time.includes("시")){
    return conv.add("일정을 예약할 시각 정보를 받지 못했습니다. 다시 예약해주세요.");
  }

  const access_token=conv.user.raw.accessToken;
  const profile = await getGoogleProfile(access_token);
  const id=profile.email;
  const startTime = await convertISOtimeFormat(params.time);

  let now=new Date();
  now=new Date(now.getTime()+540*60000);
  let start=new Date(startTime);
  console.log("현재 시간은:",now);
  console.log("예약할 시간은:",start);
  if(now.getTime()>start.getTime()){
    return conv.add("이미 지난 시간에 일정을 추가할 수 없습니다.");
  }
  
  let result= await postEventToCalender(access_token, id, conv.data.todo , startTime);
  if(result){
    conv.data.todo=undefined;
    return conv.add(`일정을 예약하였습니다.`);
  }
  conv.add("오류가 발생했습니다.");
});




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
      //const question=await translate("ko","en",params.question);
      //const answer= await translate("en","ko",await getRespondeFromOpenAI(question,conv));
      conv.add(`${answer}`);
      //conv.add(`사용자의 질문 ${params.question}`);
      //return conv.add("chatGPT의 답변입니다.");

  }
});


app.intent('upcoming events', async (conv)=>{
  const access_token=conv.user.raw.accessToken;
  const profile = await getGoogleProfile(access_token);
  const id=profile.email;

  let events = await getEventsFromCalender(access_token,id);
  
  let upcomingEvents= await filteringEvnets(events)
  if(upcomingEvents.length === 0) {
    return conv.add("일주일 안으로 다가오는 일정이 없습니다.");
  }
  conv.add("다가오는 일정은 다음과 같습니다. \n");
  const tts=await EventsTTS(upcomingEvents);
  conv.add(`${tts}`);
});


function getGoogleProfile(accessToken){
  const url=`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`;
  return new Promise((resolve,reject)=>{
    request.get({uri:url}).then(result=>{
      const profile=JSON.parse(result);
      resolve(profile);
    }).catch(error=>{
      console.log("error:",error);
      reject(false);
    })
  });
}


function getUserInformaiton(userId){
  const targetURL=mowaURL+"user/"+userId+"/";
  return new Promise((resolve,reject)=>{      
    request.get({uri:targetURL}).then(result=>{
      const Informations=JSON.parse(result);
      resolve(Informations)
    }).catch(error=>{
      console.log("error:",error);
      reject(false);
    })
  });
}

function fromAndroid(conv){
  if (conv.request.from=="AndroidMoWA"){
    return true;
  }
  else return false;
}

function getUserActivity(userId){
  const targetURL=mowaURL+"activity/"+userId+"/";
  return new Promise((resolve,reject)=>{
    request.get({uri:targetURL}).then(result=>{
      const activities=JSON.parse(result);
      /*
      for(let i in activities){
        console.log("activity:",activities[i]);
      }*/
      resolve(activities)
    }).catch(error=>{
      console.log("error:",error);
      reject(false);
    })
  });
}

function decisionForRecommend(activities){
  const todayInd=activities.length-1;
  const todaysActivityCount=activities[todayInd].activity_count;
  if(todayInd>0){
    const yesterdayActivityCount=activities[todayInd-1].activity_count;
    const Increment=todaysActivityCount-yesterdayActivityCount;
    if(Increment < RecommendThreshhold){
      return true;
    }
    return false;
  }
  return false;
}

function recommendExerciseVideo(conv){
  const PLAYLIST_ID=process.env.MOWA_YOUTUBE_LIST_ID;
  const API_KEY=process.env.YOUTUBE_API_KEY;
  const youtubeURL="https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&status=&playlistId="+PLAYLIST_ID+"&key="+API_KEY;


  if (!conv.screen && fromAndroid(conv)===false) {
    conv.ask('현재 장치에선 운동 영상을 보여드릴 수 없습니다. 안드로이드 모와 앱을 이용해주세요.');
    return;
  }
  conv.add("다음 영상을 시청해주세요!");
  return new Promise((resolve,reject)=>{
      
    request.get({uri:youtubeURL}).then(result=>{
      const parsed=JSON.parse(result);
      const videoArray=parsed.items;
      const videoCounts=parsed.pageInfo.totalResults;
      const targetIndex=Math.floor(Math.random()*(videoCounts-1));

      const videoId=videoArray[targetIndex].snippet.resourceId.videoId;
      const videoName=videoArray[targetIndex].snippet.title;
      const channelName=videoArray[targetIndex].snippet.videoOwnerChannelTitle;
      const videoThumbnailsURL=videoArray[targetIndex].snippet.thumbnails.standard.url;

      console.log(`target index=${targetIndex}, videoId=${videoId} channelName=${channelName}, thumbnailsURL==${videoThumbnailsURL}`);

      const videoURL="https://www.youtube.com/watch?v="+videoId;
   
      conv.ask(new BasicCard({
        subtitle: channelName,
        title: videoName,
        buttons: new Button({
          title: '시청하기',
          url: videoURL,
        }),
        image: new Image({
          url: videoThumbnailsURL,
        }),
        display: 'CROPPED',
      }));

      //parsing  -> Basic Card Response



      resolve(true)
    }).catch(error=>{
      console.log("error:",error);
      conv.add("오류가 발생했습니다.")
      reject(false);
    });

  });

}

function sendMessage(conv,userName,userSituation){
  const date=Date.now().toString();

  const recipientNumber=process.env.RECIPIENT_TEST_PHONE_NUMBER;
  const senderNumber=process.env.SENDER_TEST_PHONE_NUMBER;

  const serviceId=process.env.NCP_SERVICE_ID;
  const secretKey=process.env.NCP_SECRET_KEY;
  const accessKey=process.env.NCP_ACCESS_KEY;

  const apiURL=`https://sens.apigw.ntruss.com/sms/v2/services/${serviceId}/messages`;
  const apiURL2=`/sms/v2/services/${serviceId}/messages`;
  const method = "POST";
  const space = " ";
  const newLine = "\n";
  
  const hmac=CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretKey);
  hmac.update(method);
  hmac.update(space);
  hmac.update(apiURL2);
  hmac.update(newLine);
  hmac.update(date);
  hmac.update(newLine);
  hmac.update(accessKey);
  const hash = hmac.finalize();
  const signature = hash.toString(CryptoJS.enc.Base64);

  return new Promise((resolve,reject)=>{
    request({
      method: method,
      json: true,
      uri:apiURL,
      headers:{
        "Content-type": "application/json; charset=utf-8",
        "x-ncp-iam-access-key": accessKey,
        "x-ncp-apigw-timestamp": date,
        "x-ncp-apigw-signature-v2": signature,
      },
      body:{
        type: "SMS",
        countryCode: "82",
        from: senderNumber,
        content: `${userName}님으로부터 긴급 연락이 도착했습니다.\n 현재 상황:${userSituation}`,
        messages: [
          { to: `${recipientNumber}`, },],
      }
    }).then(result=>{
      console.log(result);
      conv.add("긴급 요청을 전송했습니다.");
      resolve(true);
    }).catch(error=>{
      console.log(error);
      conv.add("오류가 발생했습니다.");
      reject(false);
    });
  });  

}
 

function toggleSecurityMode(userId,information,flag){
  const targetURL=mowaURL+"user/"+userId+"/";
  const option={
      uri:targetURL,
      method:'PUT',
      body:{
        "user_id" : information.user_id,
        "serial_number" : information.serial_number,
        "mac_address" : information.mac_address,
        "mode" : flag,
        "status" : information.status
      },
      json:true
    }
  return new Promise((resolve,reject)=>{
    request(option).then(result=>{
      resolve(true);
      }).catch(error=>{
      console.log(error);
      conv.add("오류가 발생했습니다.");
      reject(false);
      });
  });

}





function translate(source,target,text){
  const options={
    url : process.env.PAPAGO_URL,
    method: "POST",
    form : {
      source : source,
      target : target,
      text : text,
      honorific : true
    },
    headers : {
      "X-NCP-APIGW-API-KEY-ID" : process.env.PAPAGO_CLIENT_ID,
      "X-NCP-APIGW-API-KEY" : process.env.PAPAGO_SECRET_KEY,
      "Content-Type" : "application/json"
    }
  };
  return new Promise((resolve, reject)=>{
    request(options).then((result)=>{
      console.log("result:",result);
      const data=JSON.parse(result);
      resolve(data.message.result.translatedText);
    }).catch((error)=>{
      console.log("error:",error);
      reject(false);
    })
  });
}


function getAnswer(conv, message){
  if(!conv.data.conversation){
    conv.data.conversation=[
      {"role" : "system" , "content" : "Your Name is MoWA and You are assistant that helping the elders living alone." },
    ]
  }
  let conversation=conv.data.conversation;
  conversation.push({"role" : "user" , "content" : message})
  const options = {
    url : "https://api.openai.com/v1/chat/completions",
    method : "POST",
    json : true,
    headers : {
      "Content-Type" : "application/json",
      "Authorization" : `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body : {
      "model" : "gpt-3.5-turbo",
      "messages" : conversation
    }
  }
  return new Promise((resolve,reject)=>{
    request(options).then((result)=>{
      console.log("openai api result:",result.choices[0].message);
      let text=result.choices[0].message.content;
      conversation.push({"role" : "assistant" , "content" : text});
      conv.data.conversation=conversation;
      resolve(text);
    }).catch((error)=>{
      console.log(error);
      reject(false);
    });
  });
}

function convertISOtimeFormat(text){
  //년 월 일 시 분  만약 생략된 부분이 있을 시 현재 기준으로.
  const regex = /[^0-9]/g;
  // let someString = "example 2023년 12월 23일 12시 30분"
  let arr=text.split(" ");
  console.log(arr);
  let year, month, date, hours, minutes;

  return new Promise((resolve,reject)=>{
    arr.map((word)=>{
      console.log("word=",word);
      if(!year) {
        word.includes("년")? year=word.replace(regex,"") : year = undefined;
        console.log("year:",year);
      }
      if(!month) {
        word.includes("월")? month=word.replace(regex,"") : month = undefined;
        console.log("month:",month);
      }
      if(!date) {
        word.includes("일")? date=word.replace(regex,"") : date = undefined
        console.log("date:",date);
      };
      if(!hours) {
        word.includes("시")? hours=word.replace(regex,"") : hours = undefined;
        console.log("hours:",hours);
      };
      if(!minutes) {
        word.includes("분")? minutes=word.replace(regex,"") :minutes = undefined;
        console.log("minutes:",minutes);
      }
    });

    const now= new Date();
    year = year?year:now.getFullYear().toString();
    month = month?month:(now.getMonth()+1).toString();
    date = date?date:now.getDate().toString();
    hours = hours?hours:now.getHours().toString();
    minutes = minutes?minutes:"00";   //now.getMinutes().toString()

    console.log(`중간 결과 y:${year} m:${month} d:${date} h:${hours} m:${minutes}`);

    if(year.length==2) year = "20"+year;
    if(month.length==1) month = "0"+month;
    if(date.length==1) date = "0"+date;
    if(hours.length==1) hours = "0"+hours;
    if(minutes.length==1) minutes = "0"+minutes;

    resolve(`${year}-${month}-${date}T${hours}:${minutes}:00`);
  });

}

function getEventsFromCalender(accessToken, id){

  const options= {
    url : `https://www.googleapis.com/calendar/v3/calendars/${id}/events?access_token=${accessToken}`,
    json : true,
    method : "GET"
  }

  return new Promise((resolve,reject)=>{
    request(options).then((result)=>{
      console.log(result.items);  //array
      resolve(result.items);
    }).catch((error)=>{
      console.log(error);
      reject(false);
    });
  
});





}

function postEventToCalender(accessToken, id, event ,startTime){

  let endTime = new Date(startTime);
  endTime =endTime.setHours(endTime.getHours()+1);
  console.log("endTime:",endTime);
  endTime = new Date(endTime).toISOString();
  endTime = endTime.substring(0,endTime.length-1);
  
  const options = {
    url : `https://www.googleapis.com/calendar/v3/calendars/${id}/events?access_token=${accessToken}`,
    json: true,
    method : "POST",
    body : {
      summary : event,
      start : {
          dateTime : startTime,
          timeZone : "Asia/Seoul"
      },
      end :  {
          dateTime : endTime,
          timeZone : "Asia/Seoul"
      }
    }
  };

  return new Promise((resolve,reject)=>{
      request(options).then((result)=>{
        console.log(result);
        resolve(true);
      }).catch((error)=>{
        console.log(error);
        reject(false);
      });
    
  });

}

function filteringEvnets(events){
  let result=[];
  let now= new Date();
  now=new Date(now.getTime()+540*60000);




  return new Promise((resolve, reject)=>{
    events.forEach((eventObj)=>{
        let eventName=eventObj.summary;
        let startTimeDate = new Date(eventObj.start.dateTime);    //한국 기준 시간-> 서버에선 Date 객체는 utc기준, 한국 시간보다 9시간 이전 시간으로 표시된다.
        startTimeDate=new Date(startTimeDate.getTime()+540*60000); //offset 
        const timeDiff=now.getTime()-startTimeDate.getTime();
        console.log("time difference msec:",timeDiff);
        if(timeDiff>0 || timeDiff< -604800000 ){
          //console.log("이미 지난 일정 혹은 일주일보다 오래걸리기에 통과");
          return ;
        }
        const dateDiff = startTimeDate.getDate()-now.getDate();
        const s1 = dateDiff===0?`오늘`:`${dateDiff}일 뒤 `;
        const s2 = `${startTimeDate.getMonth()+1}월 ${startTimeDate.getDate()}일 ${startTimeDate.getHours()}시 `;
        const s3 = startTimeDate.getMinutes()===0?`정각`:`${startTimeDate.getMinutes()}분`;
        result.push({
          name: eventName,
          tts: s1+s2+s3,
          time: startTimeDate
        });
    });
    //console.log("정렬 전: ", result);
    result.sort((e1,e2)=>{
      if(e1.time.getTime()>e2.time.getTime()) return 1;  
      else if (e1.time.getTime()<e2.time.getTime()) return -1;
      return 0;
    });
    //console.log("정렬 후: ", result);


    resolve(result);
  });
}

function EventsTTS(events){
  let result="";
  return new Promise((resolve)=>{
      events.forEach((event,index)=>{
      result+=`${event.tts}  ${event.name} ${(index===(events.length-1))?"입니다.":",\n"}\n`; 
    });
    resolve(result);
  });

}


 
exports.fulfillmentExpressServer=functions.https.onRequest(webApp);
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);