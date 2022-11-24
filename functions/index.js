'use strict';

//import {dialogflow,SignIn,Suggestions} from 'actions-on-google';
//import functions from 'firebase-functions';
//import request from 'request-promise-native'; 

const {dialogflow,SignIn,Suggestions} = require('actions-on-google');
const functions = require('firebase-functions');
const request =require('request-promise-native');

const basicURL="https://www.googleapis.com/oauth2/v1/userinfo?access_token=";


const app = dialogflow({
    clientId: process.env.CLIENT_ID,
    debug: true});


app.intent('Default Welcome Intent', async (conv) => {
  // Do things
    const token=conv.user.raw.accessToken;
    console.log("token:",token);
    if(token===undefined){
      return conv.add("안녕하세요 모와입니다. 현재 임시 사용자 모드입니다.");
      //토큰이 부여되지 않은 상태, unlink상태이기에 사용자를 guest로 인식한다.
    }
    else{
      //토큰이 부여된 상태, 토큰으로 사용자 정보에 접근하며, 토큰이 만료된 것과 아닌 것을 구분해야 한다. 
      const user= await getProfile(token,conv);
      if(user){
      //토큰이 유효한 상태다.
      const user_name=conv.data.user_name;
      conv.add(`환영합니다. ${user_name}님 모와입니다.`);
      }
      else{
        conv.add("토큰이 만료되었습니다. 모와에게 로그아웃이라고 말해주세요.");
        conv.add(new Suggestions("로그아웃"));
      }
    }

});

app.intent('test', async conv=>{
    const testAT="eyJhbGciOiJSUzI1NiIsImtpZCI6ImY4MDljZmYxMTZlNWJhNzQwNzQ1YmZlZGE1OGUxNmU4MmYzZmQ4MDUiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoi7J6E7LCs7Zi4L0FJwrfshoztlITtirjsm6jslrTtlZnrtoAo7IaM7ZSE7Yq47Juo7Ja07KCE6rO1KSIsInBpY3R1cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BSXRidm1rS3pKUGhFUnByMTFPd08tSTNuX2RtQmdiV3hCM1pxQzktQ3k2ST1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9tb3dhLWU1N2JhIiwiYXVkIjoibW93YS1lNTdiYSIsImF1dGhfdGltZSI6MTY2OTE3Nzk3OCwidXNlcl9pZCI6IlV5UmRrUnFrbHBaYmdHSGxEaUJlMHRVTk02YjIiLCJzdWIiOiJVeVJka1Jxa2xwWmJnR0hsRGlCZTB0VU5NNmIyIiwiaWF0IjoxNjY5MTc3OTc4LCJleHAiOjE2NjkxODE1NzgsImVtYWlsIjoibGNoMjAwMEBnYWNob24uYWMua3IiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwNjI2OTc4MDc1NjcxNTgxOTMwMiJdLCJlbWFpbCI6WyJsY2gyMDAwQGdhY2hvbi5hYy5rciJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.gZYr7A8GYQmpPHoebpcCfyjs1buGzch6se7i6437B5-hFaXpl7BOFN86uHtOI9rp67LZC91Wk4wNWhpsajU9-k8F6Vy27dSYN_AJnrdU2wzHnqvE7hLJCo6Es-gEJfLLAbvN_8cJQ6mT2M13rTJb_H6aDP4Pzp6lvmt5D8EE9m6-vrb_RDsTNqbSmvULMZQ9oclL1OCdLHv05HSQ-8wKhLw1fd8qyLZZyZQnE7lhrnHS94K8G12r17IPVx1bK1bQu59pT5DoyuOiNra417Xt8x563St6OTxhDIRY0c70OgIRjL-z9lom5ak1e-hvbe6oS6juxv_snQyR_mgP7Ez_YA"
    const testFinalURL="https://www.googleapis.com/oauth2/v1/tokeninfo?id_token=";
    

    const testUser=await new Promise((resolve,reject)=>{

      request.get({uri:testFinalURL+testAT}).then(result=>{
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
    console.log(testUser);
    if(testUser){
      return conv.ask('테스트성공');
    }
    else{
      conv.add("테스트 실패");
    }
  });

app.intent('sign in', async (conv)=>{
    const token=conv.user.raw.accessToken;
    const Valid=conv.data.user_Validation;
    if(token===undefined){
      conv.ask(new SignIn());
    }
    else if(Valid){
      conv.ask("이미 로그인이 완료된 상태입니다.");
    }
    else{
      conv.add("토큰이 만료되었습니다. 모와에게 로그아웃이라고 말해주세요.");
      conv.add(new Suggestions("로그아웃"));
    }
});

app.intent('sign in - yes', async (conv, params, signin) => {
    if (signin.status !== 'OK') {
      return conv.ask('로그인 과정에서 문제가 발생했습니다.');
    }
    const token=conv.user.raw.accessToken;
    const user= await getProfile(token,conv);
    if(user){
      return conv.ask('로그인이 완료되었습니다');
    }
    else{
      conv.add("토큰이 만료되었습니다. 모와에게 로그아웃이라고 말해주세요.");
      conv.add(new Suggestions("로그아웃"));
    }
  
  });

app.intent('show profile', async (conv)=>{
  const token=conv.user.raw.accessToken;
  const Valid=conv.data.user_Validation;
  if(token===undefined){
    conv.ask("로그인이 필요한 기능입니다!");
    conv.ask(new Suggestions("로그인"));
  }
  else if(Valid===true){
    const user_name=conv.data.user_name;
    const user_email=conv.data.user_email;
    conv.add(`회원님의 이름은 ${user_name}, 아이디는 ${user_email}입니다.`);
  }
  else{
    //토큰이 부여됐으며 유효한 상태, 바로 사용자 정보 가져오면 된다.
    conv.ask("토큰이 만료되었습니다. 계정 연결을 다시 진행해야 합니다. 이를 위해 모와에게 로그아웃이라고 말해주세요.");
    conv.ask(new Suggestions("로그아웃"));
  }
  
});

app.intent('Default Fallback Intent', conv=>{
    conv.add("명령을 이해하지 못했어요");
});


app.intent('security off', async conv=>{
    const token=conv.user.raw.accessToken;
    const Valid=conv.data.user_Validation;
    if(token===undefined){
      conv.ask("로그인이 필요한 기능입니다!");
      conv.ask(new Suggestions("로그인"));
    }
    else if(Valid===true){
      const URL="https://541a-210-102-180-18.jp.ngrok.io/mowa_test/";
      const user_email=conv.data.user_email;
      const finalURL=URL+user_email+"/";
      const option={
          uri:finalURL,
          method:'PUT',
          body:{
            "UserEmail":user_email,
            "Security":false
          },
          json:true
        }
      request(option).then(result=>{
        console.log(result);
        conv.add("보안 기능 종료");
        }).catch(error=>{
          console.log(error);
        conv.add("오류가 발생했습니다.");
        });
    }
    else{
      conv.ask("토큰이 만료되었습니다. 계정 연결을 다시 진행해야 합니다. 이를 위해 모와에게 로그아웃이라고 말해주세요.");
      conv.ask(new Suggestions("로그아웃"));
    }
});


app.intent('security on',async conv=>{
    const token=conv.user.raw.accessToken;
    const Valid=conv.data.user_Validation;
    if(token===undefined){
      conv.ask("로그인이 필요한 기능입니다!");
      conv.ask(new Suggestions("로그인"));
    }
    else if(Valid===true){
      const URL="https://541a-210-102-180-18.jp.ngrok.io/mowa_test/";
      const user_email=conv.data.user_email+"/";
      const finalURL=URL+user_email;
      const option={
          uri:finalURL,
          method:'PUT',
          body:{
            "UserEmail":user_email,
            "Security":true
          },
          json:true
      }
      request(option).then(result=>{
        console.log(result);
        conv.add("보안 기능 작동");
        }).catch(error=>{
          console.log(error);
        conv.add("오류가 발생했습니다.");
        });

    }
    else{
        conv.ask("토큰이 만료되었습니다. 계정 연결을 다시 진행해야 합니다. 이를 위해 모와에게 로그아웃이라고 말해주세요.");
        conv.ask(new Suggestions("로그아웃"));
      } 
})

app.intent('logout', async conv =>{
  const token=conv.user.raw.accessToken;
  if(token===undefined){
    return conv.add("로그아웃은 로그인 상태에서만 가능합니다.");
  }
  else{
    const user= await getProfile(token,conv);
    if(user){
    conv.add(`로그아웃은 사용자 정보가 만료되었을 때 진행하는 것을 권장합니다.`);
    }
    else{
      conv.add("토큰이 만료되었습니다. 모와에게 로그아웃이라고 말해주세요.");
      conv.add(new Suggestions("로그아웃"));
    }
  }
});



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