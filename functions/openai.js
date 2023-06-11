'use strict';


/**
 * 대화 모드 시 사용자의 질문을 Open API를 통해 답변을 반환합니다. 사용자의 대화 내역은 conversation의 data 영역에 저장하여 이전 대화를 이어나갈 수 있습니다.
 */

const request = require('request-promise-native');
const {DialogflowConversation} = require('actions-on-google');
require('dotenv').config();

/**
 * 사용자의 질문에 대한 chatGPT의 답변을 반환합니다.
 * @param {DialogflowConversation} conv 
 * @param {String} message 
 * @returns 
 */
exports.getAnswer= function (conv, message){
    const {status} = conv.data;
    let userName;
    if(status==="mobile"){
       userName = conv.request.name;
    }
    else{
      userName = conv.data.name;
    }
    if(!conv.data.conversation){
      conv.data.conversation=[
        {"role" : "system" , "content" : `Your Name is MoWA and You are assistant that helping the elders living alone. The User's name is ${userName}.` },
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