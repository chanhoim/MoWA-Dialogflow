'use strict';


/**
 * 안드로이드 mowa app과 상호작용을 더 용이하게 하기 위해 firebase realtime database를 선택하였습니다. 
 * 사용자의 계정 정보와 안드로이드 mowa app에서 등록한 비상연락처 정보를 저장합니다.
 */

const admin = require('firebase-admin');
const {DialogflowConversation} = require('actions-on-google');
const serviceAccount = require('./service-account.json');
require('dotenv').config();

admin.initializeApp({
    credential:admin.credential.cert(serviceAccount),
    databaseURL: process.env.DB_URL
  });

const db = admin.database();
const auth = admin.auth();


/**
 * dialogflow app의 사용자 정보를 DB에 업데이트합니다.
 * @param {DialogflowConversation} conv - dialogflow의 conversation 객체 
 * @returns {void}
 */
exports.updateUserToDB= async function (conv){
    const {userId,userName} = conv.data;
    const access_token = conv.user.raw.accessToken;
    const uid = (await auth.getUserByEmail(userId)).uid;  
    const userRef=db.ref(`dialogflow/${uid}`);
    userRef.child('id').set(userId);
    userRef.child('name').set(userName);
    userRef.child('access_token').set(access_token);
}

/**
 * DB에서 사용자의 긴급 연락처를 읽어옵니다.
 * @param  {DialogflowConversation} conv - dialogflow의 conversation 객체 
 * @returns {Array} 
 */
exports.getFirstResponder  = function(conv){
    const {status} = conv.data;
  
    return new Promise(async (resolve,reject)=>{
      let userId;
      if(status === "mobile"){
        console.log(conv.request);
        userId = conv.request.email;
      }
      else{
        userId = conv.data.userId;
      }
      const uid = (await auth.getUserByEmail(userId)).uid;
  
      db.ref(`dialogflow/${uid}/first_responder`).on('value', (snapshot)=>{
        let firstResponder = snapshot.val();
        if(firstResponder){
           let result = firstResponder.map((obj)=>{
            return { to : obj.phoneNumber.replaceAll("-","")};
          });
           resolve(result);
        }
        resolve(false);
      },(error)=>{
        console.log("database read error:",error);
        reject(false);
      })  
    }) 
}

/**
 * DB에서 사용자의 Access Token을 가져옵니다. 안드로이드 MoWA 앱에서 온 요청에 사용됩니다.
 * @param {DialogflowConversation} conv 
 * @returns {String}
 */
exports.getAccessTokenFromDB = function(conv){
    const {email} = conv.request;
    return new Promise(async (resolve,reject)=>{
      const uid = (await auth.getUserByEmail(email)).uid;
      db.ref(`dialogflow/${uid}/access_token`).on('value', (snapshot)=>{
        let access_token = snapshot.val();
        resolve(access_token);
      },(error)=>{
        console.log("database read error:",error);
        reject(false);
      })  
    })
}








