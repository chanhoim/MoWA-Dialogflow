'use strict';

/**
 * 사용자의 비상 연락처로 긴급 상황을 전달하기 위해 NCP의 SENS API를 이용합니다. 
 */

const request = require('request-promise-native');
const CryptoJS = require('crypto-js');


/**
 * 사용자의 상황을 담은 메세지와 비상 연락처를 통해 문자 메세지를 SNS로 전송합니다.
 * @param {String} message 
 * @param {Array} firstResponder 
 * @returns {Boolean}
 */
exports.sendMessage= async function (message, firstResponder){
 
    const date=Date.now().toString();
   
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
          subject : "모와 긴급 연락 전송",
          content: message,
          messages: firstResponder
        }
      }).then(result=>{
        console.log(result);
        resolve(true);
      }).catch(error=>{
        console.log(error);
        reject(false);
      });
    });  
  
  }