'use strict';


const {dialogflow,SignIn,Suggestions, BasicCard, Button, Image, Conversation} = require('actions-on-google');
const {Configuration, OpenAIApi} = require('openai');
const admin = require('firebase-admin');
const functions = require('firebase-functions');
const request = require('request-promise-native');
const CryptoJS = require('crypto-js');
const { log } = require('firebase-functions/logger');
require("dotenv").config();

const mowaURL=process.env.MOWA_URL;
const RecommendThreshhold=10;

const configuration=new Configuration({
  apiKey: process.env.OPENAI_API_KEY
});
const openai=new OpenAIApi(configuration);

const app = dialogflow({
    clientId: process.env.CLIENT_ID,
    debug: true});


/*
admin.initializeApp();
const auth = admin.auth();
const db= admin.firestore();
db.settings({timestampsInSnapshot:true});

const dbs= {
  user: db.collection('user')
};


app.middleware(async (conv) => {
  const {email} = conv.user;
  if (!conv.data.uid && email) {
    try {
      conv.data.uid = (await auth.getUserByEmail(email)).uid;
    } catch (e) {
      if (e.code !== 'auth/user-not-found') {
        throw e;
      }
      // If the user is not found, create a new Firebase auth user
      // using the email obtained from the Google Assistant
      conv.data.uid = (await auth.createUser({email})).uid;
    }
  }
  if (conv.data.uid) {
    conv.user.ref = dbs.user.doc(conv.data.uid);
  }
});
*/

app.middleware(conv =>{
  if(!conv.data.smallTalk){
    console.log("명령 모드 상태");
  }
  else{
    console.log("대화 모드 상태");
  }
});

app.intent('Default Welcome Intent', async (conv) => {
  if(fromAndroid(conv)===true){
    const request=conv.request
    return conv.add(`안녕하세요 ${request.name}님. 모와입니다.`);
  }
  const {payload}=conv.user.profile;
  if(!payload){
    conv.add("안녕하세요. 모와입니다. 현재 임시 사용자 모드입니다. 기능을 사용하기 위해 로그인을 진행 해주세요.");
    conv.add(new Suggestions("로그인"));
  }
  else{
    conv.add(`환영합니다. ${payload.name}님. 모와입니다. `);
    if(!conv.screen){
      return
    }
    const activityArrays=await getUserActivity(payload.email);
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

app.intent('sign in', async (conv)=>{
  const {payload}=conv.user.profile;
  if(!payload && fromAndroid(conv)===false){
    conv.ask(new SignIn(""));
  }
  else{
     conv.add("이미 로그인이 되어있습니다.");
  }
});

app.intent('sign in - yes', async (conv,params,signin)=>{
  if(signin.status!=='OK'){
    return conv.close("오류가 발생했습니다.");
  }
  const {payload}=conv.user.profile;
  conv.add(`환영합니다. ${payload.name}님`);
  
});

app.intent('sign in - no',conv=>{
  conv.add('로그인을 수행하지 않습니다.');
});

app.intent('test', async conv=>{
  const test= await getRespondeFromOpenAI("머리가 아파");
  console.log("test:",test);
  conv.add(`테스트 성공 ${test}`);
});



app.intent('show profile', async (conv)=>{
  if(fromAndroid(conv)===true){
    const request=conv.request
    return conv.add(`회원님의 이름은 ${request.name}, 이메일은 ${request.email}입니다.`);
  }
  const {payload}=conv.user.profile;
  if(!payload){
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));    
  }
  else{
    conv.add(`회원님의 이름은 ${payload.name}, 이메일은 ${payload.email} 입니다.`);
  } 
});



app.intent('Default Fallback Intent', async (conv)=>{
  if(!conv.data.smallTalk){
    return conv.add("명령을 이해하지 못했어요");
  }
  const question = conv.input.raw;
  const answer= await getRespondeFromOpenAI(question);
  if(!answer){
    return conv.add("오류가 발생했습니다.");
  }
  conv.add(`${answer}`);
});


app.intent('security off', async (conv)=>{
  if(fromAndroid(conv)===true){
    const id=conv.request.email;
    const information=await getUserInformaiton(id);
    if(await toggleSecurityMode(id,information,"False")){
      conv.add("보안 모드가 꺼졌습니다.")
    }
    else{
      conv.add("오류가 발생했습니다.")
    }
  }
  const {payload}=conv.user.profile;
  if(!payload){
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
  }
  else{
    const id=payload.email;
    const information=await getUserInformaiton(id);
    if(await toggleSecurityMode(id,information,"False")){
      conv.add("보안 모드가 꺼졌습니다.")
    }
    else{
      conv.add("오류가 발생했습니다.")
    }

  }
});


app.intent('security on',async (conv)=>{
  if(fromAndroid(conv)===true){
    const id=conv.request.email;
    const information=await getUserInformaiton(id);
    if(await toggleSecurityMode(id,information,"True")){
      conv.add("보안 모드가 켜졌습니다.")
    }
    else{
      conv.add("오류가 발생했습니다.")
    }
  }
  const {payload}=conv.user.profile;
  if(!payload){
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
  }
  else{
    const id=payload.email;
    const information=await getUserInformaiton(id);
    if(await toggleSecurityMode(id,information,"True")){
      conv.add("보안 모드가 켜졌습니다.")
    }
    else{
      conv.add("오류가 발생했습니다.")
    }

  }
});

app.intent('logout',  conv =>{
  if(fromAndroid(conv)===true){
    return conv.add("안드로이드에선 로그아웃이 필요하지 않습니다.")
  }
  const {payload}=conv.user.profile;
  if(!payload){
    conv.ask("현재 로그인 되지 않은 상태입니다. ");
    conv.ask(new Suggestions("로그인"));
  }
  else{
    if(!conv.screen){           //raspberry pi case
      return conv.add("현재 장치에선 로그아웃을 진행할 수 없으며 안드로이드 모와 앱에선 명령을 수행하실 수 있습니다.");
    }
    conv.add("로그아웃은 위 링크로 들어가 모와 앱의 접근 권한을 해제하시면 됩니다.");
    conv.ask(new BasicCard({
      text: `로그아웃`, 
      buttons: new Button({
        title: '로그아웃',
        url: 'https://myaccount.google.com/permissions?continue=https%3A%2F%2Fmyaccount.google.com%2Fsecurity'
      }),
      display: 'CROPPED',
    }));
  }

});

app.intent('emergency', conv=>{
  const {payload}=conv.user.profile;
  if(!payload && fromAndroid(conv)===false){
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
    conv.close();
  }
  else{
    conv.ask("현재 상황을 말씀해주세요.");
  }
});

app.intent('emergency_situation', async conv=>{
  if(fromAndroid(conv)===true){
    const name=conv.request.name;
    const situation=conv.input.raw;
    await sendMessage(conv,name,situation)
  }
  else{
    const {payload}=conv.user.profile;
    const name=payload.name;
    const situation=conv.input.raw;
    await sendMessage(conv,name,situation)
  }
});

app.intent('recommend video', async conv=>{
  const {payload}=conv.user.profile;
  if(!payload && fromAndroid(conv)===false){
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
  }
  else{
    await recommendExerciseVideo(conv);
  }
});

app.intent('small talk mode', conv =>{
    if (conv.data.smallTalk){
      return conv.add("이미 대화 모드입니다.");  
    }
    conv.data.smallTalk=true;
    conv.add("대화 모드로 변경합니다.")
});

app.intent('command mode', conv =>{
    if (!conv.data.smallTalk){
      return conv.add("이미 명령 모드입니다.")
    }
    conv.data.smallTalk=undefined;
    conv.add("명령 모드로 변경합니다.");
});



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
        "Contenc-type": "application/json; charset=utf-8",
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

async function getRespondeFromOpenAI(question){
   let translated=await translate("ko","en",question);
   console.log("question:",translated);
   const respond= await openai.createCompletion({
        model: "text-davinci-003",
        prompt : translated,
        temperature:0.7,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty : 0
      });
      let text=respond.data.choices[0].text.toString();
      text=text.replace(/\n/g, "");
      text=text.replace("+","");
      text=await translate("en","ko",text);
      console.log("af text:",text);
      return text;
}


function translate(source,target,text){
  const options={
    url : process.env.PAPAGO_URL,
    method: "POST",
    form : {
      source : source,
      target : target,
      text : text
    },
    headers : {
      "X-Naver-Client-Id" : process.env.PAPAGO_CLIENT_ID,
      "X-Naver-Client-Secret" : process.env.PAPAGO_SECRET_KEY
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
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);