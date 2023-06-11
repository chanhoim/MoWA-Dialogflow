'use strict';


/**
 * 구글에서 제공하는 API를 사용하는 functions입니다. 유저 정보나, Youtube Data API, Google Calender API를 사용합니다.  
 */

const request = require('request-promise-native');
const {DialogflowConversation, BasicCard} = require('actions-on-google');
require('dotenv').config();



/**
 * access token을 통해 사용자의 구글 계정 정보를 반환합니다.
 * @param {String} accessToken 
 * @returns {Object}
 */
exports.getGoogleProfile= function (accessToken){
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



/**
 * 사용자에게 노인들도 따라 할 수 있는 운동 영상을 유투브에서 가져와 보여줍니다. display가 없는 스피커에선 온전히 이용할 수 없습니다.
 * @param {DialogflowConversation} conv 
 * @returns {BasicCard}
 */
exports.recommendExerciseVideo= function (conv){
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
  
        resolve(true)
      }).catch(error=>{
        console.log("error:",error);
        conv.add("오류가 발생했습니다.")
        reject(false);
      });
  
    }); 
}


/**
 * 구글 캘린더 API를 사용하기 위해, 사용자가 입력한 시간을 ISO time format으로 반환해줍니다.
 * @param {String} text 
 * @returns {String}
 */
exports.convertISOtimeFormat= function (text){
    const regex = /[^0-9]/g;
    let arr=text.split(" ");
    let year, month, date, hours, minutes;
  
    return new Promise((resolve,reject)=>{
      arr.map((word)=>{
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
      minutes = minutes?minutes:"00";   
  
      if(year.length==2) year = "20"+year;
      if(month.length==1) month = "0"+month;
      if(date.length==1) date = "0"+date;
      if(hours.length==1) hours = "0"+hours;
      if(minutes.length==1) minutes = "0"+minutes;
  
      resolve(`${year}-${month}-${date}T${hours}:${minutes}:00`);
    });
  
}

/**
 * 사용자의 access token과 구글 ID를 통해 구글 캘린더에 등록된 이벤트들을 가져옵니다.
 * @param {String} accessToken 
 * @param {String} id 
 * @returns {Object}
 */
exports.getEventsFromCalender= function (accessToken, id){

    const options= {
      url : `https://www.googleapis.com/calendar/v3/calendars/${id}/events?access_token=${accessToken}`,
      json : true,
      method : "GET"
    }
  
    return new Promise((resolve,reject)=>{
      request(options).then((result)=>{
        console.log(result.items);
        resolve(result.items);
      }).catch((error)=>{
        console.log(error);
        reject(false);
      });
  });
}


/**
 * 사용자가 입력한 일정과 시간 정보를 통해 구글 캘린더에 일정을 등록합니다.
 * @param {String} accessToken 
 * @param {String} id 
 * @param {String} event 
 * @param {String} startTime -ISO Format
 * @returns {Boolean}
 */
exports.postEventToCalender= function (accessToken, id, event ,startTime){

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


/**
 * 구글 캘린더의 등록된 일정 중, 현재 기준으로 일주일 이내의 이벤트들을 가져옵니다. 
 * @param {Object} events 
 * @returns {Array}
 */
exports.filteringEvents= function (events){
    let result=[];
    let now= new Date();
    now=new Date(now.getTime()+540*60000);
  
    return new Promise((resolve, reject)=>{
      events.forEach((eventObj)=>{
          let eventName=eventObj.summary;
          let startTimeDate = new Date(eventObj.start.dateTime);    //한국 기준 시간-> 서버에선 Date 객체는 utc기준, 한국 시간보다 9시간 이전 시간으로 표시된다.
          startTimeDate=new Date(startTimeDate.getTime()+540*60000); //9시간의 offset을 수정
          const timeDiff=now.getTime()-startTimeDate.getTime();
          if(timeDiff>0 || timeDiff< -604800000 ){  //일주일 이내
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
      result.sort((e1,e2)=>{
        if(e1.time.getTime()>e2.time.getTime()) return 1;  
        else if (e1.time.getTime()<e2.time.getTime()) return -1;
        return 0;
      });  
      resolve(result);
    });
  }


  /**
   * 일주일 이내로 필터링된 이벤트 목록을 TTS를 위한 문자열로 변환합니다.
   * @param {Array} events 
   * @returns 
   */
  exports.EventsTTS= function (events){
    let result="";
    return new Promise((resolve)=>{
        events.forEach((event,index)=>{
        result+=`${event.tts}  ${event.name} ${(index===(events.length-1))?"입니다.":",\n"}\n`; 
      });
      resolve(result);
    });
  
  }


