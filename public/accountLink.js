// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-app.js";
import { getAuth,signInWithPopup,GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/9.14.0/firebase-auth.js"; 

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCFtVle5C_wsUf7AV4g7aGSXzbDxSahxkw",
  authDomain: "mowa-e57ba.firebaseapp.com",
  projectId: "mowa-e57ba",
  storageBucket: "mowa-e57ba.appspot.com",
  messagingSenderId: "213775306504",
  appId: "1:213775306504:web:78568435c2cdbff819e6bd",
  measurementId: "G-792H7VZ613"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const googlelogin=document.getElementById("googlelogin");

const auth=getAuth(app);

console.log("auth",auth);
const provider = new GoogleAuthProvider();
const loginGoogle = () => {
  return signInWithPopup(auth, provider);
};


document.addEventListener('DOMContentLoaded',()=>{

  googlelogin.onclick = () => {

    loginGoogle().then((result)=>{
  
           const urlSearch = new URLSearchParams(location.search);
           const state= urlSearch.get('state');
           console.log("state:",state);
           console.log("res:",result);
  
           const user = result.user;
           const accesstoken=result._tokenResponse.oauthAccessToken;
           const refreshtoken=result._tokenResponse.refreshToken;
           
           
           //const accesstoken=result.credential.accessToken;
           console.log("AT:",accesstoken);
           console.log("RT:",refreshtoken)
           console.log("user",user);
           const redirectApp="https://oauth-redirect.googleusercontent.com/r/mowa-e57baw#access_token="+accesstoken+"&token_type=bearer&state="+state;
           window.location.replace(redirectApp); 
    }).catch((error)=>{
           console.log(error);
           console.log("모와 회원이 아닙니다.");
    });
  }


});

