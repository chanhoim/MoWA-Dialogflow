'use strict';


/**
 * MoWA API를 사용하는 functions 입니다.
 */

const request = require('request-promise-native');
const {DialogflowConversation} = require('actions-on-google');
require('dotenv').config();


const mowaURL=process.env.MOWA_URL;
const RecommendThreshhold=10;

/**
 * 사용자의 ID를 통해 MoWA 서버로부터 사용자의 정보를 가져옵니다.
 * @param {String} userId 
 * @returns {Object}
 */
exports.getUserInformaiton= function (userId){
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

/**
 * 사용자의 ID를 통해 MoWA 서버로부터 사용자의 활동 정보를 가져옵니다.
 * @param {String} userId 
 * @returns {Array}
 */
exports.getUserActivity= function (userId){
    const targetURL=mowaURL+"activity/"+userId+"/";
    return new Promise((resolve,reject)=>{
      request.get({uri:targetURL}).then(result=>{
        const activities=JSON.parse(result);
        resolve(activities)
      }).catch(error=>{
        console.log("error:",error);
        reject(false);
      })
    });
}

/**
 * 사용자의 활동 정보를 토대로 운동 영상 추천 여부를 결정합니다.
 * @param {Array} activities 
 * @returns {Boolean}
 */
exports.decisionForRecommend= function (activities){
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


/**
 * 사용자의 보안 모드를 키거나 끕니다.
 * @param {String} userId 
 * @param {Object} information 
 * @param {Boolean} flag 
 * @returns 
 */
exports.toggleSecurityMode= function (userId,information,flag){
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


/**
 * 사용자의 현재 넘어짐 횟수를 가져옵니다.
 * @param {String} userID 
 * @returns {Number}
 */
exports.getUserFallingCount= async function (userID){
    const activities = await getUserActivity(userID);
    return activities[activities.length-1].fall_count;
}


/**
 * 사용자의 넘어짐 횟수가 증가한지를 확인하고, 증가했다면 사용자의 다음 입력에 대해 강제로 Fall Event Detect 인텐트로 넘어가게 합니다.
 * @param {DialogflowConversation} conv 
 * @returns {DialogflowConversation}
 */
exports.checkFallingDetection= function (conv){
    if(conv.data.fallingDetection){
      conv.data.fallingDetection = false;
      return conv.followup('detect');
    }
  }
  

