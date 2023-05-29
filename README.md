# MoWA Dialogflow

   
<br/>

##  1. Table of Contents

  1. [Introduction](#1-introduction)
  2. [System Architecture](#2-system-architecture)
  3. [Installation & Execution](#3-installation-&-execution)
  4. [Features](#4-features)
  5. [Utilization](#5-utilization)
  6. [Reference](#6-reference)

<br/>

## 1. Introduction

<br/>
In Project MoWA, we selected AI speakers as an auxiliary helper for users (the elderly living alone). This AI speaker is responsible for communicating with users and performing special commands. Among the various AI speaker models, we chose **Google AI speaker** that has a lot of information and is easy to install on Raspberry Pi. 
In addition, our project selected Dialogflow so that AI speakers can perform MoWA's special commands.
**Dialogflow** is a natural language understanding platform used to design and integrate a conversational user interface into mobile apps, web applications, devices, bots, interactive voice response systems and related uses.
Users can run the Dialogflow App with "Talk to MoWA" from a Google AI speaker  installed on Raspberry Pi  or smartphone MoWA app  to commands or talk.
<br/>

## 2. System Architecture 

<br/>
![MoWA_Dialogflow_Architecture](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/10d93048-3159-4ca1-b4be-a767466fe2c2)
<br/>
Please refer to the image above for system architecture.

The user runs the Dialogflow app from the Google Assistant installed on Raspberry Pi  or Android MoWA app (which is also available on Android's Google Assistant app) with "Talk to Mowa".
This Dialogflow App requires setup from the [Dialogflow console]((https://dialogflow.cloud.google.com/)). The developer have to create an Agent in the console and define the intents within the Agent to trigger the action.

<br/>
![Dialogflow_Console_Example1](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/ad53834e-b5fa-4ca7-814b-588c04792f7d)
![Dialogflow_Console_Example2](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/b7ac53ce-2ff8-463c-98e4-1d7bc1254377)
<br/>

As in the image above, you can register the intent by entering the intent name ,training phrases and defining the response. When the user says training phrases, the agent matches the intent and send the matched intent's response to user. This method is called static response. 
Static responses are simple text-oriented, so fullfillment should be used for more diverse responses. Fulfillment is a service, app, feed, conversation, or other logic that can response user requests.This is implemented through Webhook. In our project, We chose Firebase Clound Functions. The functions were written on Node.js and  [action on google nodejs library](https://github.com/actions-on-google/actions-on-google-nodejs) was used.

<br/>
![Dialogflow_Fulfillment_Example](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/33056b31-877c-45f0-82bc-feec776958d7)
<br/>
As in the image above, you can write your own responses to the intents registered in the Dialogflow console. This allows you to communicate with external APIs (Google Calendar API, YouTube API, MoWA API,  .. etc) and Database as you needed. If an error occurs during the webhook process, a static response of the dialogflow console is sended.


<br/>
![Diaglogflow_Account_Linking](https://developers.google.com/static/assistant/df-asdk/identity/images/oauth-authorization-flow.png)
<br/>

Additionally, in order to fully use our Dialogflow App, you need to log in from the Dialogflow App. Google provides [Account Linking System](https://developers.google.com/assistant/df-asdk/identity) for this. Among the Account Linking methods, We selected Oauth Linking. The Google Signin is convenient because you can log in by voice, but developer cannot adjust the scope of login. This is inappropriate to use other Google APIs that require permission.
Implementation of Oauth Linking is also divided into Implicit Flow and Authorization Code Flow.
In the latter case, you must implement Token Exchange Endpoint as well as Login Endpoint. However, we chose Authorization Code Flow because it provides the benefit of automatically renewing the token when it expires. Both Token Exchange server and Login Endpoint were implemented through the express app that was uploaded to the firebsae cloud function.
<br/>



## 3. Installation & Execution 

<br/>
The MoWA Dialogflow App runs through the Google Assistant. For this, you can use the Google Assistant app on your smartphone, But in our project, we installed Google Assistant on Raspberry Pi. Please refer to this [link](https://github.com/GachonMoWA/GassistPi) for the process of installing Google Assistant on Raspberry Pi. The next thing you need is the Dialogflow Agent. The Dialogflow Agent of our project is included in the repertoire as a compressed file. If you import this compressed file from the dialogflow console, you will be able to use the same agent as us. Or you can set up your own Agent.
<br/>

If you are a user who wants to receive this service, when we officially deploy this Dialogflow App, you can use it by simply saying  "Talk to MoWA" from the Google Assistant installed in Raspberry Pi, or from the speaker tab of the Android MoWA App.
<br/>

If you want to develop such this service, We will briefly tell you how we set up this project.
<br/>
  1. First, create Google Cloud project. <br/>
  2. Connect the Google project you just created with Dialogflow console. Then define the Agent. <br/>
  3. Set up the Firebase project for fulfillment. Please follow the instructions in the [official document](https://developers.google.com/assistant/df-asdk/deploy-fulfillment). <br/>
  4. If you had followed the tutorial in the official document above, you would have finished connecting the webhook to the dialogflow console and setting up the firebase project in your local. Now write code that handles intent within the generated function directory. <br/>
     <br/>
     ```javascript
          const {dialogflow} = require('actions-on-google');
          const functions = require('firebase-functions');
          
          const app = dialogflow({
          clientId: process.env.DIALOGFLOW_CLIENT_ID,
          debug: true
          });
          
          // Your Action for Intents
          
          exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app); 
   <br/>
   5. If you have finished writing the code within index.js, you can deploy it with the command "firebase deploy".
   <br/>

## 4. Features 

 <br/>
 Command: 
 <br/>
 <br/>
 
 |*Trigger*|Intent|Action|Context|
 |-------------------------|-------------------------|-------------------------------------------|-------------------------------------------|
 |*모와한테 말하기*|Default Welcome Intent|Run Dialogflow App.|Command Mode|
 |*로그인*|sign in|Start Account Linking Flow.|Command Mode| 
 |*로그아웃*|logout|Logout|Command Mode|
 |*긴급 상황*|emergency|Ask the user what the emergency is.|Command Mode|
 |*긴급 상황에 대한 설명*|emergency-situation|Send the emergency situation to user's emergency contact with SMS.|Command Mode & emergency-followup|
 |*운동 영상 추천해줘*|recommend video|Recommends exercise videos that even the elderly can follow.|Command Mode|
 |*일정 예약*|reservation event|Ask what schedule user want to add.|Command Mode|
 |*일정 이름*|reservation event - name|Ask for a reservation time for a schedule to add.|Command Mode & reservation event -followup|
 |*예약 시간*|reservation event - time|Register the schedule in the Google calendar.|Command Mode & reservation event -name -followup|
 |*일정 알려줘*|upcomming events|Tell about the schedule within a week of the events registered on the Google calendar.|Command Mode|
 |*보안 기능 꺼 줘*|security off|Turn off MoWA's security mode.|Command Mode|
 |*보안 기능 켜 줘*|security on|Turn on MoWA's security mode.|Command Mode|
 |*내 정보*|show profile|Tell the user's profile and activity information.|Command Mode|
 |*대화 모드*|small talk mode|If the current state is command mode, change it to conversation mode.|Command Mode|
 |*명령 모드*|command mode|If the current state is conversation mode, change it to command mode.|Conversation Mode|
 |*질문*|chatGPT|If current state is conversation mode, get an answer through chatGPT.|Conversation Mode|


 <br/>
 Conversation:
 <br/> 
 The Dialogflow App was initially developed to execute special commands, but it was determined that users would not use Dialogflow much in this situation. We wanted to increase the usage of Dialogflow App.
So we thought that if Dialogflow could be used not only for commands but also for conversation purposes, we could increase the usage. However, the small talk feature provided by Dialogflow was clearly limited. Therefore, we chose chatGPT. Among the 3.5 models of chatGPT, we chose gpt-3.5-turbo that we can assign roles to AI. 
By giving chatGPT the role of an assistant that helps the elderly, We wanted users to have a better conversation experience.
<br/>

## 5. Utilization
<br/>
The Dialogflow App is available on the Raspberry Pi Google Assistant, test page on the Google Action Console,  smartphone Google Assistant,  and android MoWA app, <br/>
<br/>

 - Google Action Console:
 ![Dialogflow_Google_Action_Console](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/15ba8548-943b-486e-b4c7-cfc540ebf5a0)<br/>
 - Raspberry Pi:
 ![Dialogflow_RaspberryPi_1](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/19c7a77a-541a-491d-9c62-f315a33fa9f8)
 ![Dialogflow_RaspberryPi_2](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/267badfd-9454-4582-ac80-416dc124f94a)<br/>
 - Android MoWA:
 
 ![Dialogflow_MoWA_Android](https://github.com/chanhoim/MoWA-Dialogflow/assets/101717041/3e920b0d-f7fe-46dc-8c40-7147f00f1b49)<br/>

    
 
  
## 6. Reference
<br/>
Google Assistant on Raspberry Pi: https://github.com/shivasiddharth/GassistPi
Dialogflow Account Linking : https://developers.google.com/assistant/df-asdk/identity
Dialogflow Fulfillment Deploy: https://developers.google.com/assistant/df-asdk/deploy-fulfillment

 
  
