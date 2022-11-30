'use strict';


const {dialogflow,SignIn,Suggestions, BasicCard, Button} = require('actions-on-google');
const functions = require('firebase-functions');
const request =require('request-promise-native');
require("dotenv").config();

const mowaURL=process.env.MOWA_URL;

const app = dialogflow({
    clientId: process.env.CLIENT_ID,
    debug: true});


app.intent('Default Welcome Intent', async (conv) => {
  // Do things
    const {payload}=conv.user.profile;
    if(payload){
      conv.add(`환영합니다. ${payload.name}님. 모와입니다. `);
    }
    else{
      conv.add("안녕하세요. 모와입니다. 현재 임시 사용자 모드입니다. 기능을 사용하기 위해 로그인을 진행 해주세요.");
      conv.add(new Suggestions("로그인"));

    }
});

app.intent('sign in', async (conv)=>{
  const {payload}=conv.user.profile;
  if(payload){
    conv.add("이미 로그인이 되어있습니다.");
  }
  else{
    conv.ask(new SignIn(""));
  }
});

app.intent('sign in - yes', async (conv,params,signin)=>{

  if(signin.status==='OK'){
    const {payload}=conv.user.profile;
    conv.add(`환영합니다. ${payload.name}님`);
  }
  else{
    conv.add("오류가 발생했습니다.");
  }
});

app.intent('sign in - no',conv=>{
  conv.add('로그인을 수행하지 않습니다.');
});

app.intent('test', conv=>{
      conv.add("테스트용 인텐트입니다.");
  });

app.intent('show profile', async (conv)=>{

  const {payload}=conv.user.profile;

  if(payload){
    conv.add(`회원님의 이름은 ${payload.name}, 이메일은 ${payload.email} 입니다.`);
    const activityArrays=await getUserActivity(payload.email);
    if(activityArrays){
      //conv.add('회원님의 활동 통계 정보를 가져오는데 성공하였습니다.');
      console.log("활동정보:",activityArrays);
      const theLastest=activityArrays[activityArrays.length-1];
      console.log("가장 최신 정보",theLastest);
      conv.add(`${theLastest.date}기준 지금까지 보안 경고 횟수 ${theLastest.warning_count}회, 활동 횟수 ${theLastest.activity_count}회, 스피커 사용 횟수 ${theLastest.speaker_count}회, 넘어짐 횟수 ${theLastest.warning_count}회 입니다.`);
      
    }
    else{
      conv.add('회원님의 활동 통계 정보를 가져오는데 실패하였습니다. 현재 스피커의 구글 계정과 안드로이드 모와 앱에서 로그인한 구글 계정과 동일한지 확인해주세요');
    }
  }
  else{
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
  }

  
});



app.intent('Default Fallback Intent', conv=>{
    conv.add("명령을 이해하지 못했어요");
});


app.intent('security off', async (conv)=>{

  const {payload}=conv.user.profile;

  if(payload){
    conv.add("보안 끄기");
    //moaw api로 put request 추가 예정
  }
  else{
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
  }
  
});


app.intent('security on',async (conv)=>{

    const {payload}=conv.user.profile;
    if(payload){
      conv.add("보안 켜기");
      //moaw api로 put request 추가 예정
    }
    else{
      conv.ask("로그인이 필요한 기능입니다!");
      conv.ask(new Suggestions("로그인"));
    }
});

app.intent('logout',  conv =>{
  const {payload}=conv.user.profile;

  if(payload){
    if(!conv.screen){           //raspberry pi case
       return conv.add("현재 장치에선 로그아웃을 진행할 수 없으며 안드로이드 모와 앱에선 명령을 수행하실 수 있습니다.");
    }
    conv.ask(new BasicCard({
      text: `로그아웃`, 
      buttons: new Button({
        title: '로그아웃',
        url: 'https://myaccount.google.com/permissions?continue=https%3A%2F%2Fmyaccount.google.com%2Fsecurity'
      }),
      display: 'CROPPED',
    }));
    
  }
  else{
    conv.ask("현재 로그인 되지 않은 상태입니다. ");
    conv.ask(new Suggestions("로그인"));
  }

});




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

function getProfile(token,conv){
    const finalURL=basicURL+token;
    return new Promise((resolve,reject)=>{

        request.get({uri:finalURL}).then(result=>{
        const user=JSON.parse(result);
        console.log(user);
        if(user){
          conv.data.user_email=user.email;
          conv.data.user_name=user.name;
          conv.data.user_Validation=true;
          resolve(user);
        }
        else {
          conv.data.user_Validation=false;
          conv.add("유저 정보를 가져오는대 실패하였습니다.");
          conv.user.raw.accessToken="";
          reject(Valid);
        }
      }).catch(error=>{
         console.log(error);
         conv.add("토큰이 만료되었습니다. 다시 로그인 해주시기 바랍니다.");
         conv.add(new Suggestions("로그인"));
         conv.user.raw.accessToken="";
         //토큰 만료. 
         conv.data.user_Validation=false;
         reject(Valid);
      });
    });
}

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);