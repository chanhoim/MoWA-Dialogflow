const express = require('express');
const request = require('request-promise-native');
const bodyParser = require('body-parser');
const url = require('url');
require('dotenv').config();
const webApp=express();

webApp.use(bodyParser.json());
webApp.use('/views',express.static(__dirname + "/views"));

const CLIENT_ID=process.env.WEB_CLIENT_ID;
const CLIENT_SECRET=process.env.WEB_CLIENT_SECRET;
const AUTHORIZE_URI=process.env.AUTHORIZE_URI;
const REDIRECT_URL=process.env.REDIRECT_URL;
const SCOPE="https://www.googleapis.com/auth/userinfo.email+https://www.googleapis.com/auth/userinfo.profile+openid+https://www.googleapis.com/auth/calendar";
const RESPONSE_TYPE="code";
const ACCESS_TYPE="offline";
const OAUTH_URL=`${AUTHORIZE_URI}?client_id=${CLIENT_ID}&response_type=${RESPONSE_TYPE}&redirect_uri=${REDIRECT_URL}&scope=${SCOPE}&access_type=${ACCESS_TYPE}&prompt=consent`;

const DIALOGFLOW_REDIRECT_URL=process.env.DIALOGFLOW_REDIRECT_URI;
let STATE=undefined;


webApp.get("/",(req,res)=>{
    res.send("Hello Express");
 });
 
 
 webApp.get("/login",(req,res)=>{
    //account linking check
    console.log("url:",req.url);
    const query=url.parse(req.url,true).query;
    //console.log("state:",STATE);    
    console.log("query:",query);
    STATE=query.state;
    console.log("state:",STATE);    
    

     res.sendFile(__dirname + "/views/login.html");
 });
 
 webApp.get("/auth/google",(req,res)=>{
    res.redirect(OAUTH_URL);
 });    

 webApp.get("/auth/handler",(req,res)=>{
    const query=url.parse(req.url,true).query;
    const redirect_uri=`${DIALOGFLOW_REDIRECT_URL}?code=${query.code}&state=${STATE}`;
    console.log("url:",req.url);
    console.log(`code:${query.code} state:${STATE}`);
    console.log("redirect url:",redirect_uri);
    return res.redirect(redirect_uri);
 });

 webApp.post("/auth/handler", async (req,res)=>{
    const query=url.parse(req.url,true).query;
    console.log("request body:",req.body);
    const {grant_type,code,redirect_uri,client_id,client_secret,refresh_token} = req.body;
    if(grant_type==="authorization_code"){
        //access token exchange
        const result=await getAccessToken(code,client_id,client_secret,redirect_uri,grant_type);
        console.log("token exchange result:",result);
        const {token_type,access_token,refresh_token,expires_in} = result;
        res.json({
            "token_type": token_type ,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": expires_in
        });
    }
    else if (grant_type==="refresh_token"){
        //refresh access token
        const result=await refreshAccessToken(client_id,client_secret,grant_type,refresh_token);
        const {token_type,access_token,expires_in} = result;
        res.json({
            "token_type": token_type ,
            "access_token": access_token,
            "expires_in": expires_in
        });
    }
    else{
        //error
        res.send("Invalid Access");
    }
   
 }); 


 webApp.get('/auth/unlinking',(req,res)=>{
     return res.send(401);
 });



function getAccessToken(code,client_id,client_secret,redirect_uri,grant_type){
    const url=`https://oauth2.googleapis.com/token?code=${code}&client_id=${client_id}&client_secret=${client_secret}&redirect_uri=https://mowa-e57ba.web.app/auth/handler&grant_type=${grant_type}`;
    const option ={
        url:url,
        method : "POST",
    }
    return new Promise((resolve,reject)=>{
        request(option).then((result)=>{
            const data=JSON.parse(result);
            resolve(data);
        }).catch((error)=>{
            console.log("error:",error);
            reject(false);
        })
    });
}

function refreshAccessToken(client_id,client_secret,grant_type,refresh_token){
    const url=`https://oauth2.googleapis.com/token?client_id=${client_id}&client_secret=${client_secret}&refresh_token=${refresh_token}&grant_type=${grant_type}`;
    const option ={
        url:url,
        method : "POST",
    }
    return new Promise((resolve,reject)=>{
        request(option).then((result)=>{
            const data=JSON.parse(result);
            resolve(data);
        }).catch((error)=>{
            console.log("error:",error);
            reject(false);
        })
    });
}



module.exports = webApp;