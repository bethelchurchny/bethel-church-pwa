import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { auth, db, storage, messaging, getToken, VAPID_KEY } from './firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, deleteDoc, query, orderBy, onSnapshot, updateDoc, getDocs, where, arrayUnion } from 'firebase/firestore';

const LOGO_URL = '/logo.png';
const th = {
  primary:'#1a3a6b', accent:'#c8a84b', accentLight:'#e8c96a',
  bg:'#f5f5f0', text:'#1a1a2e', textMid:'#4a5568', textLight:'#8a9ab5',
  border:'#e2e8f0', danger:'#e53e3e', success:'#38a169', warning:'#d69e2e',
};

const generateSchedules = () => {
  const s=[], today=new Date(), day=today.getDay(), dfm=day===0?6:day-1;
  const mon=new Date(today); mon.setDate(today.getDate()-dfm); mon.setHours(0,0,0,0);
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  const wed=new Date(mon); wed.setDate(mon.getDate()+2);
  const fri=new Date(mon); fri.setDate(mon.getDate()+4);
  let id=1;
  ['07:30 AM','09:00 AM','10:45 AM','12:30 PM'].forEach(t=>s.push({id:id++,title:'Sunday Service',date:fmt(sun),time:t,location:'87-07 Justice Ave, Elmhurst, NY',type:'regular'}));
  s.push({id:id++,title:'Youth Fellowship',date:fmt(fri),time:'07:00 PM',location:'87-07 Justice Ave, Elmhurst, NY',type:'youth'});
  s.push({id:id++,title:'Prayer Meeting',date:fmt(wed),time:'06:00 AM',location:'87-07 Justice Ave, Elmhurst, NY',type:'prayer'});
  s.push({id:id++,title:'Wednesday Bible Study',date:fmt(wed),time:'07:30 PM',location:'87-07 Justice Ave, Elmhurst, NY',type:'regular'});
  return s.sort((a,b)=>new Date(a.date)-new Date(b.date));
};
const SCHEDULES = generateSchedules();
const CHURCH_LOC = {lat:40.7375701,lng:-73.8761094,radiusM:100};

const distM=(lat1,lon1,lat2,lon2)=>{
  const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};

const S={
  app:{maxWidth:430,margin:'0 auto',minHeight:'100vh',backgroundColor:th.bg,fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'},
  card:{backgroundColor:'white',borderRadius:20,padding:16,marginBottom:12,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'},
  btn:{backgroundColor:th.primary,color:'white',border:'none',borderRadius:14,padding:'14px 24px',fontSize:15,fontWeight:700,cursor:'pointer',width:'100%'},
  inp:{width:'100%',padding:13,fontSize:15,borderRadius:14,border:`2px solid ${th.border}`,outline:'none',boxSizing:'border-box',backgroundColor:'white'},
  screen:{paddingTop:'70px',paddingBottom:'100px',overflowY:'scroll',height:'calc(100vh)',WebkitOverflowScrolling:'touch',boxSizing:'border-box'},
};

const Btn=({label,onClick,variant='primary',disabled=false,style:st={}})=>{
  const bg=variant==='primary'?th.primary:variant==='gold'?th.accent:variant==='danger'?th.danger:th.success;
  const color=variant==='gold'?th.primary:'white';
  return <button onClick={onClick} disabled={disabled} style={{...S.btn,backgroundColor:bg,color,opacity:disabled?0.5:1,...st}}>{label}</button>;
};
const Card=({children,style:st={},onClick})=>(
  <div onClick={onClick} style={{...S.card,cursor:onClick?'pointer':'default',...st}}>{children}</div>
);
const Inp=({label,value,onChange,placeholder,type='text',rightEl})=>(
  <div style={{marginBottom:14}}>
    {label&&<label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{label}</label>}
    <div style={{position:'relative',display:'flex',alignItems:'center',border:`2px solid ${th.border}`,borderRadius:14,backgroundColor:'white'}}>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
        style={{...S.inp,border:'none',flex:1}}/>
      {rightEl}
    </div>
  </div>
);

const Header=({lang,setLang,onBell,unreadCount,onLogout})=>(
  <div style={{backgroundColor:th.primary,padding:'36px 24px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,zIndex:100,boxSizing:'border-box'}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <img src={LOGO_URL} style={{width:34,height:34,borderRadius:17,border:'2px solid rgba(255,255,255,0.3)',objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
      <div>
        <div style={{color:'white',fontWeight:800,fontSize:15}}>Bethel Int'l Church</div>
        <div style={{color:th.accentLight,fontSize:11,fontWeight:600}}>New York</div>
      </div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button onClick={()=>setLang(lang==='en'?'id':'en')} style={{backgroundColor:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.2)',borderRadius:12,padding:'3px 8px',color:'white',fontWeight:700,fontSize:10,cursor:'pointer'}}>
        {lang.toUpperCase()}
      </button>
      <div style={{position:'relative',cursor:'pointer'}} onClick={onBell}>
        <span style={{fontSize:17}}>🔔</span>
        {unreadCount>0&&<div style={{position:'absolute',top:-4,right:-4,backgroundColor:th.danger,borderRadius:8,minWidth:14,height:14,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 2px'}}>
          <span style={{color:'white',fontSize:9,fontWeight:800}}>{unreadCount>9?'9+':unreadCount}</span>
        </div>}
      </div>
      <button onClick={onLogout} style={{backgroundColor:'rgba(255,255,255,0.12)',border:'none',borderRadius:12,padding:'3px 8px',color:'rgba(255,255,255,0.9)',fontSize:10,fontWeight:600,cursor:'pointer'}}>Sign Out</button>
    </div>
  </div>
);

const BottomNav=({active,onNav,lang})=>{
  const tabs=[
    {key:'home',label:'Home',icon:'🏠'},{key:'checkin',label:'Check In',icon:'📍'},
    {key:'give',label:lang==='id'?'Donasi':'Give',icon:'💝'},{key:'schedule',label:lang==='id'?'Jadwal':'Schedule',icon:'📅'},
    {key:'profile',label:'Profile',icon:'👤'},
  ];
  return(
    <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,backgroundColor:'white',borderTop:`1px solid ${th.border}`,display:'flex',padding:'8px 0 24px',zIndex:100}}>
      {tabs.map(tab=>(
        <button key={tab.key} onClick={()=>onNav(tab.key)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:2,cursor:'pointer',border:'none',background:'none',padding:'4px 0',color:active===tab.key?th.primary:th.textLight}}>
          <div style={{backgroundColor:active===tab.key?`${th.primary}20`:'transparent',borderRadius:12,padding:6,fontSize:20}}>{tab.icon}</div>
          <span style={{fontSize:10,fontWeight:active===tab.key?700:400}}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
};

const LoginScreen=({lang,setLang,onRegister,regSuccess})=>{
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [showPw,setShowPw]=useState(false);
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const [showForgot,setShowForgot]=useState(false);
  const [resetEmail,setResetEmail]=useState('');
  const [resetSent,setResetSent]=useState(false);
  const [resetErr,setResetErr]=useState('');

  const handleLogin=async()=>{
    setErr('');
    if(!email||!pw){setErr(lang==='id'?'Email dan password harus diisi':'Please fill in all fields');return;}
    setLoading(true);
    try{await signInWithEmailAndPassword(auth,email,pw);}
    catch(e){setErr(lang==='id'?'Email atau password salah':'Invalid email or password');setLoading(false);}
  };

  const handleReset=async()=>{
    if(!resetEmail){setResetErr(lang==='id'?'Masukkan email':'Enter your email');return;}
    try{await sendPasswordResetEmail(auth,resetEmail);setResetSent(true);setResetErr('');}
    catch(e){setResetErr(lang==='id'?'Email tidak ditemukan':'Email not found');}
  };

  if(showForgot) return(
    <div style={{minHeight:'100vh',backgroundColor:th.bg}}>
      <div style={{backgroundColor:th.primary,padding:'60px 32px 40px',textAlign:'center',position:'relative'}}>
        <button onClick={()=>setShowForgot(false)} style={{position:'absolute',top:16,left:16,backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'6px 12px',color:'white',cursor:'pointer',fontSize:16}}>←</button>
        <img src={LOGO_URL} style={{width:90,height:90,borderRadius:45,marginBottom:16,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
        <h2 style={{color:'white',margin:'0 0 4px',fontSize:20,fontWeight:700}}>{lang==='id'?'Lupa Password?':'Forgot Password?'}</h2>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{lang==='id'?'Masukkan email untuk reset password':'Enter email to reset password'}</div>
      </div>
      <div style={{padding:24}}>
        {resetSent?(
          <div style={{textAlign:'center',padding:20}}>
            <div style={{fontSize:60,marginBottom:16}}>📧</div>
            <h3 style={{color:th.primary,marginBottom:12}}>{lang==='id'?'Email Terkirim!':'Email Sent!'}</h3>
            <p style={{color:th.textMid,marginBottom:24}}>{lang==='id'?'Cek inbox kamu untuk link reset password.':'Check your inbox for the reset link.'}</p>
            <Btn label={lang==='id'?'Kembali ke Login':'Back to Login'} onClick={()=>setShowForgot(false)}/>
          </div>
        ):(
          <div>
            {resetErr&&<div style={{backgroundColor:'#fff5f5',borderRadius:12,padding:12,marginBottom:16,color:th.danger}}>{resetErr}</div>}
            <Inp label="Email" value={resetEmail} onChange={setResetEmail} placeholder="your@email.com" type="email"/>
            <Btn label={lang==='id'?'Kirim Link Reset':'Send Reset Link'} onClick={handleReset} style={{marginTop:8}}/>
            <div onClick={()=>setShowForgot(false)} style={{textAlign:'center',marginTop:16,color:th.textLight,cursor:'pointer',fontSize:13}}>{lang==='id'?'Kembali ke Login':'Back to Login'}</div>
          </div>
        )}
      </div>
    </div>
  );

  return(
    <div style={{minHeight:'100vh',backgroundColor:th.bg}}>
      <div style={{backgroundColor:th.primary,padding:'60px 32px 40px',textAlign:'center',position:'relative'}}>
        <button onClick={()=>setLang(lang==='en'?'id':'en')} style={{position:'absolute',top:16,right:16,backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 12px',color:'white',fontWeight:700,fontSize:12,cursor:'pointer'}}>{lang.toUpperCase()} 🌐</button>
        <img src={LOGO_URL} style={{width:100,height:100,borderRadius:50,marginBottom:16,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
        <h2 style={{color:'white',margin:'0 0 4px',fontSize:22,fontWeight:700}}>Bethel International Church</h2>
        <div style={{color:th.accentLight,fontSize:13,fontWeight:600,marginBottom:4}}>New York</div>
        <div style={{color:'rgba(255,255,255,0.55)',fontSize:13}}>{lang==='id'?'Hidup dan Berbagi Injil':'Living and Sharing the Gospel'}</div>
      </div>
      <div style={{padding:24}}>
        <h2 style={{textAlign:'center',fontSize:24,fontWeight:800,marginBottom:16}}>{lang==='id'?'Selamat Datang':'Welcome'}</h2>
        {regSuccess&&<div style={{backgroundColor:'#f0fff4',borderRadius:12,padding:12,marginBottom:16,color:th.success,fontWeight:600}}>✓ {lang==='id'?'Akun berhasil dibuat! Silakan masuk.':'Account created! Please sign in.'}</div>}
        {err&&<div style={{backgroundColor:'#fff5f5',borderRadius:12,padding:12,marginBottom:16,color:th.danger}}>{err}</div>}
        <Inp label="Email" value={email} onChange={setEmail} placeholder="your@email.com" type="email"/>
        <Inp label="Password" value={pw} onChange={setPw} placeholder="••••••••" type={showPw?'text':'password'}
          rightEl={<button onClick={()=>setShowPw(!showPw)} style={{background:'none',border:'none',cursor:'pointer',padding:'0 14px',fontSize:16}}>{showPw?'🙈':'👁️'}</button>}/>
        <Btn label={loading?(lang==='id'?'Memproses...':'Signing in...'):(lang==='id'?'Masuk':'Sign In')} onClick={handleLogin} disabled={loading} style={{marginTop:4}}/>
        <div onClick={()=>setShowForgot(true)} style={{textAlign:'center',marginTop:12,color:th.textLight,cursor:'pointer',fontSize:13}}>{lang==='id'?'Lupa password?':'Forgot password?'}</div>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:12,fontSize:13}}>
          <span style={{color:th.textLight}}>{lang==='id'?'Belum punya akun?':'No account?'}</span>
          <span onClick={onRegister} style={{color:th.primary,fontWeight:700,cursor:'pointer'}}>{lang==='id'?'Daftar di sini':'Register here'}</span>
        </div>
      </div>
    </div>
  );
};

const RegisterScreen=({lang,setLang,onBack,onRegistered})=>{
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [pw,setPw]=useState('');
  const [pw2,setPw2]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);

  const handleReg=async()=>{
    setErr('');
    if(!name||!email||!pw||!pw2){setErr(lang==='id'?'Semua kolom wajib diisi':'Please fill in all fields');return;}
    if(pw!==pw2){setErr(lang==='id'?'Password tidak cocok':'Passwords do not match');return;}
    setLoading(true);
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,pw);
      await setDoc(doc(db,'members',cred.user.uid),{name,email,phone,role:'member',joinDate:new Date().toLocaleDateString(),createdAt:new Date().toISOString()});
      await addDoc(collection(db,'notifications'),{type:'new_member',userName:name,userEmail:email,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),readBy:[]});
      onRegistered();
    }catch(e){
      if(e.code==='auth/email-already-in-use')setErr(lang==='id'?'Email sudah terdaftar':'Email already registered');
      else setErr(e.message);
      setLoading(false);
    }
  };

  return(
    <div style={{minHeight:'100vh',backgroundColor:th.bg}}>
      <div style={{backgroundColor:th.primary,padding:'60px 32px 36px',textAlign:'center',position:'relative'}}>
        <button onClick={onBack} style={{position:'absolute',top:16,left:16,backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'6px 12px',color:'white',cursor:'pointer',fontSize:16}}>←</button>
        <img src={LOGO_URL} style={{width:80,height:80,borderRadius:40,marginBottom:14,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
        <h2 style={{color:'white',margin:'0 0 4px',fontSize:20,fontWeight:700}}>{lang==='id'?'Buat Akun':'Create Account'}</h2>
      </div>
      <div style={{padding:24}}>
        {err&&<div style={{backgroundColor:'#fff5f5',borderRadius:12,padding:12,marginBottom:16,color:th.danger}}>{err}</div>}
        <Inp label={lang==='id'?'Nama Lengkap':'Full Name'} value={name} onChange={setName} placeholder="Your full name"/>
        <Inp label="Email" value={email} onChange={setEmail} placeholder="your@email.com" type="email"/>
        <Inp label={lang==='id'?'Nomor HP':'Phone'} value={phone} onChange={setPhone} placeholder="+1 234 567 8900" type="tel"/>
        <Inp label="Password" value={pw} onChange={setPw} placeholder="••••••••" type="password"/>
        <Inp label={lang==='id'?'Konfirmasi Password':'Confirm Password'} value={pw2} onChange={setPw2} placeholder="••••••••" type="password"/>
        <Btn label={loading?(lang==='id'?'Mendaftarkan...':'Creating...'):(lang==='id'?'Daftar Sekarang':'Create Account')} onClick={handleReg} disabled={loading} style={{marginTop:8}}/>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:16,fontSize:13}}>
          <span style={{color:th.textLight}}>{lang==='id'?'Sudah punya akun?':'Already have an account?'}</span>
          <span onClick={onBack} style={{color:th.primary,fontWeight:700,cursor:'pointer'}}>{lang==='id'?'Masuk':'Sign In'}</span>
        </div>
      </div>
    </div>
  );
};

const HomeScreen=({user,onNav,lang,lp={}})=>{
  const [eventPosts,setEventPosts]=useState([]);
  const [showAppQR,setShowAppQR]=useState(false);
  const [todayDevo,setTodayDevo]=useState(null);
  useEffect(()=>{
    const days=['sun','mon','tue','wed','thu','fri','sat'];
    const todayKey=days[new Date().getDay()];
    const unsubDevo=onSnapshot(query(collection(db,'bulletins'),orderBy('timestamp','desc')),snap=>{
      const devos=snap.docs.map(d=>({id:d.id,...d.data()})).filter(b=>b.cat==='devotional'&&b.subType==='daily_devotional'&&b.dayOfWeek===todayKey);
      setTodayDevo(devos.length>0?devos[0]:null);
    });
    return unsubDevo;
  },[]);
  useEffect(()=>{
    const unsub=onSnapshot(query(collection(db,'bulletins'),orderBy('timestamp','desc')),snap=>{
      const today=new Date().toISOString().split('T')[0];
      const events=snap.docs.map(d=>({id:d.id,...d.data()})).filter(b=>b.cat==='event');
      const upcoming=events.filter(e=>!e.eventDate||e.eventDate>=today).sort((a,b)=>{
        if(!a.eventDate) return 1;
        if(!b.eventDate) return -1;
        return a.eventDate.localeCompare(b.eventDate);
      });
      setEventPosts(upcoming);
    });
    return unsub;
  },[]);
  const exportMembers = async () => {
    try {
      const snap = await getDocs(collection(db,'members'));
      const members = snap.docs.map(d=>d.data());
      
      // Build CSV
      const headers = ['Name','Email','Phone','Address','Join Date','Birth Date','Baptism Date','First Church Date','Role'];
      const rows = members.map(m=>[
        m.name||'',
        m.email||'',
        m.phone||'',
        m.address||'',
        m.joinDate||'',
        m.birthDate||'',
        m.baptismDate||'',
        m.firstChurchDate||'',
        m.role||'member',
      ]);
      
      const csv = [headers, ...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bethel_Members_${new Date().toLocaleDateString('en-CA')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      alert('Export failed: ' + e.message);
    }
  };
  const hr=new Date().getHours();
  const greeting=hr<12?(lang==='id'?'Selamat Pagi':'Good Morning'):hr<17?(lang==='id'?'Selamat Siang':'Good Afternoon'):(lang==='id'?'Selamat Malam':'Good Evening');
  const quickCards=[
    {key:'checkin',label:lang==='id'?'Check In':'Check In',icon:'📍',bg:'#e8f4e8'},
    {key:'give',label:lang==='id'?'Donasi':'Give',icon:'💝',bg:'#fff8e8'},
    {key:'bulletin',label:lang==='id'?'Warta':'Bulletin',icon:'📋',bg:'#e8eef8'},
    {key:'report',label:lang==='id'?'Laporan':'Report',icon:'📄',bg:'#f8e8e8'},
    {key:'request',label:lang==='id'?'Permohonan':'Request',icon:'📝',bg:'#e8f8f4'},
    {key:'volunteer',label:'Volunteer',icon:'🙋',bg:'#fef3e8'},
    {key:'classes',label:lang==='id'?'Kelas':'Classes',icon:'📚',bg:'#f0e8ff'},
    ...(user.role==='admin'?[{key:'notify',label:lang==='id'?'Kirim Notif':'Send Notif',icon:'📣',bg:'#e8f0fe'}]:[]),
    ...((user.role==='admin'||user.role==='usher'||(user.role==='leader'&&lp.scanAttendance))?[{key:'scan',label:lang==='id'?'Scan Hadir':'Scan Attendance',icon:'📷',bg:'#e8fef0'}]:[]),
  ];
  const verse=lang==='id'
    ?'"Karena itu pergilah, jadikanlah semua bangsa murid-Ku dan baptislah mereka dalam nama Bapa dan Anak dan Roh Kudus."'
    :'"Go therefore and make disciples of all the nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit."';
  return(
    <div style={S.screen}>
      <div style={{padding:16,paddingBottom:200}}>
        <div style={{backgroundColor:th.primary,borderRadius:24,padding:22,boxShadow:`0 6px 16px ${th.primary}40`,marginBottom:16}}>
          <div style={{color:'rgba(255,255,255,0.65)',fontSize:13}}>{greeting},</div>
          <div style={{color:'white',fontSize:22,fontWeight:800,margin:'2px 0 10px'}}>{user.name||user.email}</div>
          <span style={{backgroundColor:'rgba(200,168,75,0.25)',borderRadius:20,padding:'5px 12px',color:th.accentLight,fontSize:11,fontWeight:700,letterSpacing:1,border:'1px solid rgba(200,168,75,0.5)'}}>
            {(user.role||'MEMBER').toUpperCase()}
          </span>
        </div>
        {('Notification' in window && Notification.permission !== 'granted') && (
          <div style={{backgroundColor:'#fff8e8',borderRadius:16,padding:14,marginBottom:14,display:'flex',alignItems:'center',gap:12,border:`1.5px solid ${th.accent}`}}>
            <span style={{fontSize:28}}>🔔</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:th.primary,marginBottom:2}}>{lang==='id'?'Aktifkan Notifikasi':'Enable Notifications'}</div>
              <div style={{fontSize:11,color:th.textMid}}>{lang==='id'?'Tap untuk dapat info terbaru dari gereja':'Tap to receive updates from church'}</div>
            </div>
            <button onClick={async()=>{
              try{
                const permission = await Notification.requestPermission();
                alert('Permission: '+permission);
                if(permission==='granted'){
                  if(!messaging){ alert('Messaging not available'); return; }
                  const token = await getToken(messaging,{vapidKey:VAPID_KEY,serviceWorkerRegistration:await navigator.serviceWorker.getRegistration()});
                  if(token){
                    await setDoc(doc(db,'members',user.uid),{fcmToken:token},{merge:true});
                    alert('Token saved! '+token.slice(0,20)+'...');
                  } else {
                    alert('No token received');
                  }
                }
              }catch(e){alert('Error: '+e.message);}
            }} style={{backgroundColor:th.accent,border:'none',borderRadius:12,padding:'8px 12px',color:th.primary,fontWeight:700,fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>
              {lang==='id'?'Aktifkan':'Enable'}
            </button>
          </div>
        )}
        {todayDevo&&(
          <div onClick={()=>{onNav('bulletin',{...todayDevo,_categoryOnly:false});}} style={{backgroundColor:'#fef9e7',borderRadius:18,padding:16,marginBottom:16,cursor:'pointer',boxShadow:'0 2px 8px rgba(183,121,31,0.1)',border:'1.5px solid #b7791f30'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{fontSize:22}}>☀️</span>
              <div>
                <div style={{fontSize:10,fontWeight:700,color:'#b7791f',textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Renungan Harian Hari Ini':"Today's Daily Devotional"}</div>
                <div style={{fontSize:13,color:'#b7791f',fontWeight:600}}>{({sun:lang==='id'?'Minggu':'Sunday',mon:lang==='id'?'Senin':'Monday',tue:lang==='id'?'Selasa':'Tuesday',wed:lang==='id'?'Rabu':'Wednesday',thu:lang==='id'?'Kamis':'Thursday',fri:lang==='id'?'Jumat':'Friday',sat:lang==='id'?'Sabtu':'Saturday'})[todayDevo.dayOfWeek]}</div>
              </div>
            </div>
            <div style={{fontSize:15,fontWeight:700,color:th.text,marginBottom:4}}>{(lang==='id'?(todayDevo.titleId||todayDevo.title):(todayDevo.title||todayDevo.titleId))||(lang==='id'?'Baca Renungan':'Read Devotional')}</div>
            <div style={{fontSize:12,color:'#b7791f',fontWeight:600}}>{lang==='id'?'Tap untuk baca →':"Tap to read →"}</div>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
          {quickCards.map(c=>(
            <div key={c.key} onClick={()=>onNav(c.key)}
              style={{backgroundColor:c.bg,borderRadius:18,padding:16,cursor:'pointer',boxShadow:'0 2px 5px rgba(0,0,0,0.05)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
              <div style={{fontSize:28,marginBottom:12}}>{c.icon}</div>
              <div style={{fontSize:14,fontWeight:700,color:th.text}}>{c.label}</div>
            </div>
          ))}
        </div>
        {eventPosts.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,color:th.text,marginBottom:10}}>🎉 {lang==='id'?'Acara Mendatang':'Upcoming Events'}</div>
            {eventPosts.slice(0,3).map(ev=>{
              const dispContent=lang==='id'?(ev.contentId||ev.content):(ev.content||ev.contentId);
              return(
                <div key={ev.id} onClick={()=>onNav('bulletin',ev)}
                  style={{backgroundColor:'#f3e8ff',borderRadius:16,padding:14,marginBottom:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'space-between',border:'1.5px solid #9b59b620'}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:'#9b59b6'}}>{ev.title||dispContent?.slice(0,50)}</div>
                    {ev.eventDate&&<div style={{fontSize:11,color:'#9b59b699',marginTop:2,fontWeight:600}}>📅 {new Date(ev.eventDate+'T00:00:00').toLocaleDateString(lang==='id'?'id-ID':'en-US',{day:'numeric',month:'short',year:'numeric'})}</div>}
                  </div>
                  <span style={{fontSize:20,color:'#9b59b6'}}>›</span>
                </div>
              );
            })}
            {eventPosts.length>3&&(
              <div onClick={()=>onNav('bulletin',{cat:'event',_categoryOnly:true})} style={{textAlign:'center',padding:10,color:'#9b59b6',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                {lang==='id'?`Lihat Semua (${eventPosts.length})`:`View All (${eventPosts.length})`} →
              </div>
            )}
          </div>
        )}
        <Card>
          <div style={{fontSize:11,fontWeight:700,color:th.accent,marginBottom:10,letterSpacing:1.5,textTransform:'uppercase'}}>Matthew 28:19</div>
          <div style={{fontSize:15,color:th.text,lineHeight:1.7,fontStyle:'italic',marginBottom:12}}>{verse}</div>
          <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:10,borderTop:`1px solid ${th.border}`}}>
            <img src={LOGO_URL} style={{width:22,height:22,borderRadius:11,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
            <span style={{fontSize:11,color:th.textLight}}>Bethel International Church · New York</span>
          </div>
        </Card>
        {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
          <div style={{backgroundColor:'white',borderRadius:20,padding:16,marginBottom:12,boxShadow:'0 2px 8px rgba(0,0,0,0.06)',border:`2px solid ${th.primary}20`}}>
            <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:12,textTransform:'uppercase',letterSpacing:1}}>Admin Tools</div>
            <button onClick={()=>onNav('roles')}
            style={{width:'100%',backgroundColor:`${th.warning}10`,border:`2px solid ${th.warning}`,borderRadius:14,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontSize:14,fontWeight:700,color:th.warning,marginBottom:10}}>
            <span style={{fontSize:24}}>👥</span>
            <div style={{textAlign:'left'}}>
              <div>{lang==='id'?'Kelola Role':'Role Management'}</div>
              <div style={{fontSize:11,fontWeight:400,color:th.textMid,marginTop:2}}>{lang==='id'?'Atur akses Usher/Admin':'Manage Usher/Admin access'}</div>
            </div>
          </button>
          <button onClick={exportMembers}
              style={{width:'100%',backgroundColor:`${th.primary}10`,border:`2px solid ${th.primary}`,borderRadius:14,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontSize:14,fontWeight:700,color:th.primary,marginBottom:10}}>
              <span style={{fontSize:24}}>📊</span>
              <div style={{textAlign:'left'}}>
                <div>{lang==='id'?'Export Data Member':'Export Member Data'}</div>
                <div style={{fontSize:11,fontWeight:400,color:th.textMid,marginTop:2}}>{lang==='id'?'Download file CSV semua member':'Download CSV of all members'}</div>
              </div>
              <span style={{marginLeft:'auto',fontSize:18}}>↓</span>
            </button>
            <button onClick={()=>setShowAppQR(true)}
              style={{width:'100%',backgroundColor:'#e8f4e8',border:'2px solid #38a169',borderRadius:14,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontSize:14,fontWeight:700,color:'#38a169'}}>
              <span style={{fontSize:24}}>📲</span>
              <div style={{textAlign:'left'}}>
                <div>{lang==='id'?'QR Code Download App':'App Download QR Code'}</div>
                <div style={{fontSize:11,fontWeight:400,color:th.textMid,marginTop:2}}>{lang==='id'?'Share ke jemaat baru':'Share with new members'}</div>
              </div>
            </button>
          </div>
        )}
      {showAppQR&&(
        <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,height:'100vh',backgroundColor:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowAppQR(false)}>
          <div style={{backgroundColor:'white',borderRadius:24,padding:32,textAlign:'center',margin:20}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:700,color:th.primary,marginBottom:4}}>Bethel International Church</div>
            <div style={{fontSize:13,color:th.textMid,marginBottom:20}}>Elmhurst, New York</div>
            <QRCode value="https://bethel-nyc.vercel.app" size={200} fgColor="#1a3a6b" level="H"/>
            <div style={{fontSize:14,fontWeight:700,color:th.primary,marginTop:16,marginBottom:4}}>{lang==='id'?'📱 Scan untuk Download App':'📱 Scan to Download App'}</div>
            <div style={{fontSize:12,color:th.textMid,marginBottom:20}}>bethel-nyc.vercel.app</div>
            <button onClick={()=>setShowAppQR(false)} style={{width:'100%',backgroundColor:th.primary,border:'none',borderRadius:12,padding:'12px',color:'white',fontWeight:700,fontSize:14,cursor:'pointer'}}>{lang==='id'?'Tutup':'Close'}</button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

const CheckInScreen=({user,lang,lp={}})=>{
  const [status,setStatus]=useState('idle');
  const [dist,setDist]=useState(null);
  const [checkins,setCheckins]=useState([]);
  const [allCheckinsData,setAllCheckinsData]=useState([]);
  const [locations,setLocations]=useState([]);
  const [selectedLoc,setSelectedLoc]=useState(null);
  const [showAddLoc,setShowAddLoc]=useState(false);
  const [newLocName,setNewLocName]=useState('');
  const [newLocAddr,setNewLocAddr]=useState('');
  const [newLocLat,setNewLocLat]=useState('');
  const [newLocLng,setNewLocLng]=useState('');
  const [editLocId,setEditLocId]=useState(null);
  const [geocoding,setGeocoding]=useState(false);
  const [showReport,setShowReport]=useState(false);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'checkins'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      setCheckins(all.filter(c=>c.userId===user.uid));
      if(user.role==='admin'||(user.role==='leader'&&(lp.checkInReport||lp.exportCsv))) setAllCheckinsData(all);
    });
    return unsub;
  },[user.uid,user.role]);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'locations'),snap=>{
      setLocations(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);

  const allLocations = locations;

  const alreadyToday=(locId)=>checkins.some(c=>c.locationId===locId&&c.date===new Date().toLocaleDateString());

  const handleAddLocation=async()=>{
    if(!newLocName||!newLocAddr)return;
    setGeocoding(true);
    try{
      let finalLat, finalLng;
      if(newLocLat && newLocLng){
        finalLat=parseFloat(newLocLat); finalLng=parseFloat(newLocLng);
        if(isNaN(finalLat)||isNaN(finalLng)){alert('Invalid coordinates.');setGeocoding(false);return;}
      }else{
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(newLocAddr)}&format=json&limit=1`);
        const data = await res.json();
        if(data.length===0){alert('Address not found. Please try a more specific address.');setGeocoding(false);return;}
        finalLat=parseFloat(data[0].lat); finalLng=parseFloat(data[0].lon);
      }
      await addDoc(collection(db,'locations'),{name:newLocName,address:newLocAddr,lat:finalLat,lng:finalLng,radiusM:100,createdAt:new Date().toISOString()});
      setNewLocName('');setNewLocAddr('');setNewLocLat('');setNewLocLng('');setShowAddLoc(false);
    }catch(e){alert('Error: '+e.message);}
    setGeocoding(false);
  };

  const handleDeleteLocation=async(id)=>await deleteDoc(doc(db,'locations',id));


  const handleEditLocation=(loc)=>{
    setEditLocId(loc.id);
    setNewLocName(loc.name);
    setNewLocAddr(loc.address);
    setNewLocLat(String(loc.lat));
    setNewLocLng(String(loc.lng));
    setShowAddLoc(true);
  };

  const handleUpdateLocation=async()=>{
    if(!newLocName||!newLocAddr||!newLocLat||!newLocLng)return;
    const lat=parseFloat(newLocLat), lng=parseFloat(newLocLng);
    if(isNaN(lat)||isNaN(lng)){alert('Invalid coordinates.');return;}
    setGeocoding(true);
    try{
      await updateDoc(doc(db,'locations',editLocId),{name:newLocName,address:newLocAddr,lat,lng});
      setNewLocName('');setNewLocAddr('');setNewLocLat('');setNewLocLng('');setEditLocId(null);setShowAddLoc(false);
    }catch(e){alert('Error: '+e.message);}
    setGeocoding(false);
  };

  const handleCI=async()=>{
    if(!selectedLoc){alert(lang==='id'?'Pilih lokasi dulu':'Please select a location');return;}
    if(alreadyToday(selectedLoc.id)){setStatus('already');return;}
    setStatus('locating');
    if(!navigator.geolocation){setStatus('no_gps');return;}
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const d=Math.round(distM(pos.coords.latitude,pos.coords.longitude,selectedLoc.lat,selectedLoc.lng));
        setDist(d);
        if(d<=selectedLoc.radiusM){
          await addDoc(collection(db,'checkins'),{userId:user.uid,userName:user.name,locationId:selectedLoc.id,locationName:selectedLoc.name,distanceM:d,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
          setStatus('success');setTimeout(()=>setStatus('idle'),3000);
        }else setStatus('too_far');
      },
      err=>setStatus(err.code===1?'denied':'no_gps'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    );
  };

  const si={
    success:{icon:'✅',msg:lang==='id'?'✓ Check In Berhasil!':'✓ Check In Successful!',sub:lang==='id'?'Selamat beribadah, Tuhan Yesus memberkati 🙏':'Enjoy the service, God bless 🙏',color:th.success},
    too_far:{icon:'🚫',msg:lang==='id'?`Kamu ${dist}m dari lokasi. Harus dalam ${selectedLoc?.radiusM||100}m.`:`You are ${dist}m away. Must be within ${selectedLoc?.radiusM||100}m.`,color:th.danger},
    no_gps:{icon:'📵',msg:lang==='id'?'GPS tidak tersedia':'GPS not available',color:th.danger},
    denied:{icon:'🔒',msg:lang==='id'?'Akses lokasi ditolak':'Location access denied',color:th.danger},
    already:{icon:'⚠️',msg:lang==='id'?'Sudah check in hari ini di lokasi ini':'Already checked in today at this location',color:th.warning},
    locating:{icon:'🔍',msg:lang==='id'?'Memverifikasi lokasi...':'Verifying location...',color:th.primary},
  }[status];

  const allCheckins = (user.role==='admin'||(user.role==='leader'&&(lp.checkInReport||lp.exportCsv))) ? allCheckinsData : checkins;
  const groupedCheckins = allCheckins.reduce((acc,c)=>{
    if(!acc[c.date]) acc[c.date]=[];
    acc[c.date].push(c);
    return acc;
  },{});

  const handleExportCheckinsCSV=()=>{
    const rows=[['Name','Location','Date','Time','Distance(m)']];
    allCheckins.slice().sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp)).forEach(c=>{
      rows.push([c.userName||'',c.locationName||'',c.date||'',new Date(c.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),c.distanceM??'']);
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download=`checkins_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return(
    <div style={{padding:'16px',paddingTop:'90px',height:'calc(100vh - 80px)',overflowY:'auto',WebkitOverflowScrolling:'touch',boxSizing:'border-box'}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700,marginBottom:4}}>{lang==='id'?'Check In':'Check In'}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{lang==='id'?'Pilih lokasi & verifikasi':'Select location & verify'}</div>
      </div>

      {si&&<div style={{backgroundColor:si.color+'15',borderRadius:14,padding:14,marginBottom:16,display:'flex',gap:10,border:`1px solid ${si.color}30`}}>
        <span style={{fontSize:20}}>{si.icon}</span>
        <div>
          <div style={{color:si.color,fontWeight:600}}>{si.msg}</div>
          {si.sub&&<div style={{color:si.color,fontSize:12,marginTop:2}}>{si.sub}</div>}
        </div>
      </div>}

      <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Pilih Lokasi':'Select Location'}</div>

      {allLocations.map(loc=>{
        const done=alreadyToday(loc.id);
        const selected=selectedLoc?.id===loc.id;
        return(
          <div key={loc.id} onClick={()=>!done&&setSelectedLoc(loc)}
            style={{backgroundColor:'white',borderRadius:16,padding:14,marginBottom:10,border:`2px solid ${selected?th.primary:done?th.success+'50':th.border}`,cursor:done?'default':'pointer',boxShadow:'0 2px 6px rgba(0,0,0,0.05)'}}>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <div style={{width:44,height:44,backgroundColor:selected?th.primary:done?'#e8f4e8':th.bg,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>
                {done?'✅':'📍'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:700,color:done?th.success:th.text}}>{loc.name}</div>
                <div style={{fontSize:12,color:th.textMid,marginTop:2}}>{loc.address}</div>
                {done&&<div style={{fontSize:11,color:th.success,marginTop:2,fontWeight:600}}>✓ {lang==='id'?'Sudah check in hari ini':'Checked in today'}</div>}
              </div>
              {selected&&!done&&<div style={{width:20,height:20,borderRadius:10,backgroundColor:th.primary,display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{color:'white',fontSize:12}}>✓</span>
              </div>}
            </div>
            {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
              <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${th.border}`,display:'flex',justifyContent:'flex-end',gap:8}}>
                <button onClick={e=>{e.stopPropagation();handleEditLocation(loc);}} style={{backgroundColor:'#f0f4ff',border:'none',borderRadius:10,padding:'4px 10px',color:th.primary,fontSize:11,fontWeight:700,cursor:'pointer'}}>✏️ Edit</button>
                {!loc.isMain&&(
                  <button onClick={e=>{e.stopPropagation();handleDeleteLocation(loc.id);}} style={{backgroundColor:'#fff0f0',border:'none',borderRadius:10,padding:'4px 10px',color:th.danger,fontSize:11,fontWeight:700,cursor:'pointer'}}>🗑 Delete</button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
        <div style={{marginBottom:16}}>
          {showAddLoc?(
            <div style={{backgroundColor:'white',borderRadius:16,padding:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{editLocId?(lang==='id'?'Edit Lokasi':'Edit Location'):(lang==='id'?'Tambah Lokasi':'Add Location')}</div>
              <Inp label={lang==='id'?'Nama Lokasi':'Location Name'} value={newLocName} onChange={setNewLocName} placeholder="e.g. Branch Queens"/>
              <Inp label={lang==='id'?'Alamat Lengkap':'Full Address'} value={newLocAddr} onChange={setNewLocAddr} placeholder="123 Main St, Queens, NY 11354"/>
              <div style={{display:'flex',gap:8}}>
                <Inp label={lang==='id'?'Latitude (opsional)':'Latitude (optional)'} value={newLocLat} onChange={setNewLocLat} placeholder="40.7375701"/>
                <Inp label={lang==='id'?'Longitude (opsional)':'Longitude (optional)'} value={newLocLng} onChange={setNewLocLng} placeholder="-73.8761094"/>
              </div>
              <div style={{fontSize:11,color:th.textMid,marginBottom:14}}>📍 {lang==='id'?'Isi Lat/Lng untuk koordinat manual (akurat). Kosongkan untuk auto-detect dari alamat.':'Fill Lat/Lng for manual coordinates (accurate). Leave blank to auto-detect from address.'}</div>
              <div style={{display:'flex',gap:8}}>
                <Btn label={lang==='id'?'Batal':'Cancel'} onClick={()=>{setShowAddLoc(false);setEditLocId(null);setNewLocName('');setNewLocAddr('');setNewLocLat('');setNewLocLng('');}} variant='outline' style={{flex:1}}/>
                <Btn label={geocoding?(lang==='id'?'Menyimpan...':'Saving...'):editLocId?(lang==='id'?'Simpan':'Save'):(lang==='id'?'Tambah':'Add')} onClick={editLocId?handleUpdateLocation:handleAddLocation} disabled={!newLocName||!newLocAddr||geocoding} style={{flex:1}}/>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowAddLoc(true)}
              style={{width:'100%',border:`2px dashed ${th.border}`,borderRadius:16,padding:14,backgroundColor:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,color:th.textMid,fontSize:14,fontWeight:600}}>
              <span style={{fontSize:20}}>+</span> {lang==='id'?'Tambah Lokasi Baru':'Add New Location'}
            </button>
          )}
        </div>
      )}

      <Btn label={status==='locating'?(lang==='id'?'Memverifikasi...':'Verifying...'):status==='success'?(lang==='id'?'✓ Berhasil!':'✓ Success!'):(lang==='id'?'Check In Sekarang':'Check In Now')}
        onClick={handleCI} disabled={status==='locating'||status==='success'||!selectedLoc}
        style={{backgroundColor:status==='success'?th.success:!selectedLoc?'#ccc':th.primary,marginBottom:16}}/>

      {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
        <button onClick={()=>setShowReport(!showReport)}
          style={{width:'100%',backgroundColor:`${th.accent}15`,border:`2px solid ${th.accent}`,borderRadius:14,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:700,color:th.primary,marginBottom:16}}>
          📊 {showReport?(lang==='id'?'Sembunyikan Report':'Hide Report'):(lang==='id'?'Lihat Report Check In':'View Check In Report')}
        </button>
      )}

      {user.role==='admin'&&showReport&&(
        <div style={{backgroundColor:'white',borderRadius:18,padding:16,marginBottom:16,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:16,fontWeight:700}}>📊 {lang==='id'?'Report Check In':'Check In Report'}</div>
            <button onClick={handleExportCheckinsCSV} style={{backgroundColor:`${th.primary}15`,border:`1px solid ${th.primary}`,borderRadius:10,padding:'6px 12px',color:th.primary,fontSize:12,fontWeight:700,cursor:'pointer'}}>📥 {lang==='id'?'Export CSV':'Export CSV'}</button>
          </div>
          {Object.keys(groupedCheckins).length===0?(
            <div style={{textAlign:'center',padding:20,color:th.textMid}}>{lang==='id'?'Belum ada data':'No data yet'}</div>
          ):Object.entries(groupedCheckins).sort((a,b)=>new Date(b[0])-new Date(a[0])).map(([date,members])=>(
            <div key={date} style={{marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8,paddingBottom:8,borderBottom:`1px solid ${th.border}`}}>
                <span style={{fontSize:14,fontWeight:700,color:th.primary}}>📅 {date}</span>
                <span style={{backgroundColor:`${th.primary}15`,borderRadius:20,padding:'4px 10px',fontSize:12,fontWeight:700,color:th.primary}}>{members.length} {lang==='id'?'jemaat':'members'}</span>
              </div>
              {members.map((m,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:i<members.length-1?`1px solid ${th.border}50`:'none'}}>
                  <div style={{width:32,height:32,borderRadius:16,backgroundColor:th.accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontSize:12,fontWeight:700,color:th.primary}}>{(m.userName||'?')[0].toUpperCase()}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:600}}>{m.userName}</div>
                    <div style={{fontSize:11,color:th.textLight}}>{m.locationName} · {new Date(m.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {checkins.length>0&&!showReport&&(
        <div>
          <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Riwayat Check In':'Recent Check-Ins'}</div>
          {checkins.slice(-5).reverse().map(c=>(
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${th.border}`}}>
              <span style={{fontSize:22}}>✅</span>
              <div>
                <div style={{fontSize:14,fontWeight:600}}>{c.locationName}</div>
                <div style={{fontSize:12,color:th.textLight}}>{c.date}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const GiveScreen=({user,lang})=>{
  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Donasi & Persembahan':'Giving & Offerings'}</div>
      </div>
      <Card>
        <div style={{fontSize:11,fontWeight:700,color:th.accent,marginBottom:10,letterSpacing:1.5,textTransform:'uppercase'}}>{lang==='id'?'2 Korintus 9:7':'2 Corinthians 9:7'}</div>
        <div style={{fontSize:15,color:th.text,lineHeight:1.7,fontStyle:'italic',marginBottom:12}}>
          {lang==='id'
            ?'Hendaklah masing-masing memberikan menurut kerelaan hatinya, jangan dengan sedih hati atau karena paksaan, sebab Allah mengasihi orang yang memberi dengan sukacita.'
            :'Each of you should give what you have decided in your heart to give, not reluctantly or under compulsion, for God loves a cheerful giver.'}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:10,marginBottom:14,borderTop:`1px solid ${th.border}`}}>
          <img src={LOGO_URL} style={{width:22,height:22,borderRadius:11,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
          <span style={{fontSize:11,color:th.textLight}}>Bethel International Church · New York</span>
        </div>
        <a href="https://give.tithe.ly/?formId=0a29c133-aaae-4e82-9b4e-d1499697054b" target="_blank" rel="noreferrer"
          style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:th.primary,color:'white',borderRadius:14,padding:14,textDecoration:'none',fontWeight:700,fontSize:14,border:`2px solid ${th.accent}`}}>
          🙏 Give via Tithe.ly
        </a>
      </Card>
    </div></div>
  );
};

const ScheduleScreen=({user,lang,lp={}})=>{
  const [selectedType,setSelectedType]=useState(null);
  const [showAdd,setShowAdd]=useState(false);
  const [addTitle,setAddTitle]=useState('');
  const [addDate,setAddDate]=useState('');
  const [addTime,setAddTime]=useState('');
  const [addType,setAddType]=useState('regular');
  const [addContact,setAddContact]=useState('');
  const [addPhone,setAddPhone]=useState('');
  const [addLocation,setAddLocation]=useState('87-07 Justice Ave, Elmhurst, NY');
  const [addRecurring,setAddRecurring]=useState(false);
  const [editingId,setEditingId]=useState(null);
  const [customSchedules,setCustomSchedules]=useState([]);

  const typeConfig={
    regular:{label:lang==='id'?'Ibadah':'Service',emoji:'⛪',bg:'#e8eef8',color:th.primary,desc:lang==='id'?'Ibadah mingguan jemaat':'Weekly congregation service'},
    youth:{label:lang==='id'?'Pemuda':'Youth',emoji:'🎉',bg:'#e8f4e8',color:th.success,desc:lang==='id'?'Persekutuan pemuda':'Youth fellowship & activities'},
    prayer:{label:lang==='id'?'Doa':'Prayer',emoji:'🙏',bg:'#fff8e8',color:th.warning,desc:lang==='id'?'Pertemuan doa bersama':'Corporate prayer meeting'},
    cool:{label:'COOL',emoji:'❤️',bg:'#f3e8ff',color:'#7c3aed',desc:lang==='id'?'Community of Love':'Community of Love groups'},
    core:{label:'CORE',emoji:'🔥',bg:'#fff0e8',color:'#c05621',desc:lang==='id'?'Kelompok inti gereja':'Core church group'},
  };

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'schedules'),snap=>{
      setCustomSchedules(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);

  const hiddenIds=customSchedules.filter(s=>s.hidden).map(s=>s.originalId);
  const today=new Date();
  const dayNum=today.getDay();
  const dfm=dayNum===0?6:dayNum-1;
  const monday=new Date(today); monday.setDate(today.getDate()-dfm); monday.setHours(0,0,0,0);
  const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  const recurringInstances = customSchedules.filter(s=>s.recurring&&!s.hidden).map(s=>{
    const targetDate=new Date(monday);
    const diff=(s.dayOfWeek - 1 + 7) % 7;
    targetDate.setDate(monday.getDate()+diff);
    return {...s, date:fmt(targetDate), id:s.id+'_'+fmt(targetDate), originalRecurringId:s.id};
  });

  const nonRecurringCustom = customSchedules.filter(s=>!s.recurring&&!s.hidden);
  const allSchedules=[...SCHEDULES.filter(s=>!hiddenIds.includes(String(s.id))),...nonRecurringCustom,...recurringInstances].sort((a,b)=>{
    const dateCompare = new Date(a.date)-new Date(b.date);
    if(dateCompare!==0) return dateCompare;
    return (a.time||'').localeCompare(b.time||'');
  });

  const handleAdd=async()=>{
    if(!addDate||!addTime)return;
    const dayOfWeek=new Date(addDate+'T00:00:00').getDay();
    const data={title:addTitle||(lang==='id'?typeConfig[addType]?.label:typeConfig[addType]?.label)||addType,date:addDate,time:addTime,type:addType,contact:addContact,phone:addPhone,location:addType==='cool'?'':addLocation,custom:true,recurring:addRecurring,dayOfWeek:addRecurring?dayOfWeek:null};
    if(editingId&&customSchedules.some(s=>s.id===editingId)){
      await updateDoc(doc(db,'schedules',editingId),data);
    }else if(editingId){
      // Editing a default schedule: hide original and create override
      await addDoc(collection(db,'schedules'),{hidden:true,originalId:String(editingId),custom:false});
      await addDoc(collection(db,'schedules'),data);
    }else{
      await addDoc(collection(db,'schedules'),data);
    }
    setAddTitle('');setAddDate('');setAddTime('');setAddContact('');setAddPhone('');setAddLocation('87-07 Justice Ave, Elmhurst, NY');setEditingId(null);setShowAdd(false);
  };

  const handleDelete=async id=>{
    const isCustom=customSchedules.some(s=>s.id===id);
    if(isCustom){
      await deleteDoc(doc(db,'schedules',id));
    } else {
      await addDoc(collection(db,'schedules'),{hidden:true,originalId:String(id),custom:false});
    }
  };

  if(selectedType){
    const cfg=typeConfig[selectedType]||{label:selectedType,emoji:'📅',bg:'#e8eef8',color:th.primary,desc:''};
    const items=allSchedules.filter(s=>s.type===selectedType);
    return(
      <div style={S.screen}>
        <div style={{backgroundColor:cfg.color,padding:'20px 20px 24px',borderRadius:24,margin:16,marginBottom:0}}>
          <div onClick={()=>setSelectedType(null)} style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}}>
            <span style={{color:'rgba(255,255,255,0.8)',fontSize:16}}>←</span>
            <span style={{color:'rgba(255,255,255,0.8)',fontSize:14,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:8}}>
            <div style={{width:60,height:60,borderRadius:30,backgroundColor:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>{cfg.emoji}</div>
            <div>
              <div style={{color:'white',fontSize:24,fontWeight:800}}>{cfg.label}</div>
              <div style={{color:'rgba(255,255,255,0.7)',fontSize:13,marginTop:2}}>{cfg.desc}</div>
            </div>
          </div>
        </div>
        <div style={{padding:16}}>
          {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
            <div onClick={()=>{setAddType(selectedType);setShowAdd(!showAdd);}}
              style={{border:`2px dashed ${cfg.color}40`,borderRadius:14,padding:14,marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',backgroundColor:cfg.bg}}>
              <span style={{fontSize:18}}>{showAdd?'✕':'+'}</span>
              <span style={{fontSize:14,fontWeight:700,color:cfg.color}}>{showAdd?(lang==='id'?'Batal':'Cancel'):(lang==='id'?'Tambah Jadwal':'Add Schedule')}</span>
            </div>
          )}
          {showAdd&&(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
            <Card>
              <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{editingId?'Edit':'Add'} Schedule</div>
              <Inp label="Title (optional)" value={addTitle} onChange={setAddTitle} placeholder="Event title..."/>
              <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Lokasi':'Location'}</label>
              <select value={addLocation} onChange={e=>setAddLocation(e.target.value)} style={{...S.inp,marginBottom:14}}>
                <option value="87-07 Justice Ave, Elmhurst, NY">87-07 Justice Ave, Elmhurst, NY</option>
                <option value="88-39 53rd Ave, Elmhurst, NY">88-39 53rd Ave, Elmhurst, NY</option>
              </select>
              <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>Date</label>
              <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value)} style={{...S.inp,marginBottom:14,WebkitAppearance:"none",appearance:"none",width:"100%",boxSizing:"border-box"}}/>
              <Inp label="Time" value={addTime} onChange={setAddTime} placeholder="09:00 AM"/>
              {selectedType==='cool'&&<><Inp label="Leader Name" value={addContact} onChange={setAddContact} placeholder="Leader name..."/><Inp label="Leader Phone" value={addPhone} onChange={setAddPhone} placeholder="+1 234 567 8900" type="tel"/></>}
              <div onClick={()=>setAddRecurring(!addRecurring)} style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,cursor:'pointer'}}>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${addRecurring?th.primary:th.border}`,backgroundColor:addRecurring?th.primary:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {addRecurring&&<span style={{color:'white',fontSize:14}}>✓</span>}
                </div>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:th.text}}>{lang==='id'?'Ulangi Setiap Minggu':'Repeat Weekly'}</div>
                  <div style={{fontSize:11,color:th.textMid}}>{lang==='id'?'Jadwal akan otomatis muncul setiap minggu':'Schedule will auto-appear every week'}</div>
                </div>
              </div>
              <Btn label={editingId?'Update':'Save'} onClick={handleAdd} disabled={!addDate||!addTime}/>
            </Card>
          )}
          {items.length===0?(
            <div style={{textAlign:'center',padding:48}}>
              <div style={{fontSize:48,marginBottom:16}}>{cfg.emoji}</div>
              <div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Tidak ada jadwal':'No schedule this week'}</div>
            </div>
          ):items.map(s=>{
            const d=new Date(s.date+'T00:00:00');
            const isCustom=customSchedules.some(c=>c.id===s.id||c.id===s.originalRecurringId);
            return(
              <Card key={s.id} style={{borderLeft:`4px solid ${cfg.color}`}}>
                <div style={{display:'flex',gap:14}}>
                  <div style={{backgroundColor:cfg.bg,width:54,height:54,borderRadius:16,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{color:cfg.color,fontSize:20,fontWeight:800,lineHeight:1}}>{d.getDate()}</span>
                    <span style={{color:cfg.color+'99',fontSize:9,textTransform:'uppercase'}}>{d.toLocaleDateString('en',{month:'short'})}</span>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{s.title}</div>
                    <div style={{fontSize:12,color:th.textMid}}>🕐 {s.time}</div>
                    {s.type!=='cool'&&s.location&&<div style={{fontSize:11,color:th.textLight,marginTop:2}}>📍 {s.location}</div>}
                    {s.type==='cool'&&(s.contact||s.phone)&&<div style={{fontSize:12,color:cfg.color,marginTop:4}}>{s.contact?`👤 ${s.contact}`:''}{s.contact&&s.phone?' · ':''}{s.phone?`📞 ${s.phone}`:''}</div>}
                    {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&<div style={{display:'flex',gap:14,marginTop:6}}>
                      <span onClick={()=>{setEditingId(s.originalRecurringId||s.id);setAddTitle(s.title);setAddDate(s.date);setAddTime(s.time);setAddType(s.type);setAddContact(s.contact||'');setAddPhone(s.phone||'');setAddLocation(s.location||'87-07 Justice Ave, Elmhurst, NY');setShowAdd(true);}} style={{fontSize:11,color:th.primary,fontWeight:600,cursor:'pointer'}}>✏️ Edit</span>
                      <span onClick={()=>handleDelete(s.originalRecurringId||s.id)} style={{fontSize:11,color:th.danger,fontWeight:600,cursor:'pointer'}}>🗑 Delete</span>
                    </div>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return(
    <div style={S.screen}>
      <div style={{padding:16,paddingBottom:200}}>
        <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
          <div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Jadwal Ibadah':'Service Schedule'}</div>
          <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{lang==='id'?'Minggu Ini':'This Week'}</div>
        </div>
        {Object.entries(typeConfig).map(([key,cfg])=>{
          const items=allSchedules.filter(s=>s.type===key);
          return(
            <div key={key} onClick={()=>setSelectedType(key)}
              style={{backgroundColor:cfg.bg,borderRadius:22,padding:20,marginBottom:14,cursor:'pointer',boxShadow:`0 4px 10px ${cfg.color}25`,border:`1.5px solid ${cfg.color}25`}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{width:56,height:56,borderRadius:28,backgroundColor:`${cfg.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{cfg.emoji}</div>
                  <div>
                    <div style={{fontSize:18,fontWeight:800,color:cfg.color}}>{cfg.label}</div>
                    <div style={{fontSize:12,color:`${cfg.color}99`,marginTop:2}}>{cfg.desc}</div>
                  </div>
                </div>
                <span style={{fontSize:22,color:cfg.color}}>›</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BulletinScreen=({user,lang,directPost,clearDirectPost,lp={}})=>{
  const [fontSize,setFontSize]=useState(15);
  const [selectedCat,setSelectedCat]=useState(null);
  const [selectedSubType,setSelectedSubType]=useState(null);
  const [selectedPost,setSelectedPost]=useState(null);
  const [view,setView]=useState('list');
  const [title,setTitle]=useState('');
  const [titleId,setTitleId]=useState('');
  const [content,setContent]=useState('');
  const [contentId,setContentId]=useState('');
  const [eventDate,setEventDate]=useState('');
  const [textAlign,setTextAlign]=useState('left');
  const [imageUrl,setImageUrl]=useState('');
  const [uploading,setUploading]=useState(false);
  const [cat,setCat]=useState('announcement');
  const [subType,setSubType]=useState('general');
  const [dayOfWeek,setDayOfWeek]=useState('mon');
  const [weekDays,setWeekDays]=useState({mon:{en:'',id:''},tue:{en:'',id:''},wed:{en:'',id:''},thu:{en:'',id:''},fri:{en:'',id:''},sat:{en:'',id:''},sun:{en:'',id:''}});
  const [writeLang,setWriteLang]=useState('id');
  const [editingPost,setEditingPost]=useState(null);

  useEffect(()=>{
    if(directPost){
      setSelectedCat(directPost.cat);
      if(directPost.cat==='devotional') setSelectedSubType(directPost.subType||'general');
      if(!directPost._categoryOnly){
        setSelectedPost(directPost);
      }
      if(clearDirectPost) clearDirectPost();
    }
  },[directPost]);
  const [bulletins,setBulletins]=useState([]);

  useEffect(()=>{
    if(selectedSubType==='reading_plan'&&view!=='write'){
      const items=bulletins.filter(b=>b.cat==='devotional'&&(b.subType||'general')==='reading_plan')
        .sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
      if(items.length>0) setSelectedPost(items[0]);
      else setSelectedPost(null);
    }
  },[selectedSubType,bulletins,view]);

  const catConfig={
    announcement:{label:lang==='id'?'Pengumuman':'Announcement',emoji:'📢',bg:'#fff8e8',color:'#d69e2e',desc:lang==='id'?'Pengumuman gereja':'Church announcements'},
    devotional:{label:lang==='id'?'Renungan':'Devotional',emoji:'🙏',bg:'#e8eef8',color:'#1a3a6b',desc:lang==='id'?'Renungan harian':'Daily devotionals'},
    news:{label:lang==='id'?'Berita Gereja':'Church News',emoji:'📰',bg:'#e8f4e8',color:'#38a169',desc:lang==='id'?'Berita gereja':'Church news'},
    event:{label:lang==='id'?'Info Acara':'Event Info',emoji:'🎉',bg:'#f3e8ff',color:'#9b59b6',desc:lang==='id'?'Info acara':'Event info'},
  };

  const devSubConfig={
    general:{label:lang==='id'?'Renungan Umum':'General Devotional',emoji:'🙏',bg:'#e8eef8',color:'#1a3a6b',desc:lang==='id'?'Renungan umum':'General devotionals'},
    reading_plan:{label:lang==='id'?'Rencana Baca Alkitab':'Bible Reading Plan',emoji:'📖',bg:'#fef3e2',color:'#c2410c',desc:lang==='id'?'Rencana baca Alkitab mingguan':'Weekly Bible reading plan'},
    daily_devotional:{label:lang==='id'?'Renungan Harian':'Daily Devotional',emoji:'☀️',bg:'#fef9e7',color:'#b7791f',desc:lang==='id'?'Renungan setiap hari':'Daily devotional reading'},
    weekly_message:{label:lang==='id'?'Pesan Mingguan':'Weekly Message',emoji:'✉️',bg:'#e8f8f0',color:'#0d9488',desc:lang==='id'?'Pesan mingguan gembala':'Weekly pastor message'},
  };

  useEffect(()=>{
    const unsub=onSnapshot(query(collection(db,'bulletins'),orderBy('timestamp','desc')),snap=>{
      setBulletins(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);

  const handleSave=async()=>{
    const isWeekDaysType = subType==='reading_plan';
    if(!isWeekDaysType && !content&&!contentId)return;
    const payload = isWeekDaysType
      ? {title,titleId,subType,weekDays,cat:selectedCat,eventDate,textAlign,imageUrl}
      : subType==='daily_devotional'
        ? {title,titleId,subType,content,contentId,dayOfWeek,cat:selectedCat,eventDate,textAlign,imageUrl}
        : {title,titleId,subType,content,contentId,eventDate,textAlign,imageUrl};
    if(editingPost){
      await updateDoc(doc(db,'bulletins',editingPost.id),payload);
      setEditingPost(null);
    }else{
      await addDoc(collection(db,'bulletins'),{...payload,cat:selectedCat,userId:user.uid,userName:user.name,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
      const catLabel=selectedSubType?devSubConfig[selectedSubType]?.label:catConfig[selectedCat]?.label;
      await addDoc(collection(db,'notifications'),{type:'new_bulletin',title:title||(lang==='id'?'Post baru':'New post'),category:catLabel||selectedCat,cat:selectedCat,subType:selectedSubType||'general',userName:user.name,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),readBy:[]});
    }
    setTitle('');setTitleId('');setContent('');setContentId('');setEventDate('');setTextAlign('left');setImageUrl('');setSubType('general');
    setWeekDays({mon:{en:'',id:''},tue:{en:'',id:''},wed:{en:'',id:''},thu:{en:'',id:''},fri:{en:'',id:''},sat:{en:'',id:''},sun:{en:'',id:''}});
    setView('list');
  };

  const handleEditClick=(post)=>{
    setSelectedPost(null);
    setEditingPost(post);
    setTitle(post.title||'');
    setTitleId(post.titleId||'');
    setContent(post.content||'');
    setContentId(post.contentId||'');
    setEventDate(post.eventDate||'');
    setTextAlign(post.textAlign||'left');
    setImageUrl(post.imageUrl||'');
    setSubType(post.subType||'general');
    setWeekDays(post.weekDays||{mon:{en:'',id:''},tue:{en:'',id:''},wed:{en:'',id:''},thu:{en:'',id:''},fri:{en:'',id:''},sat:{en:'',id:''},sun:{en:'',id:''}});
    setDayOfWeek(post.dayOfWeek||'mon');
    if(post.subType==='reading_plan'||post.subType==='daily_devotional'){
      const hasId = Object.values(post.weekDays||{}).some(d=>d?.id);
      setWriteLang(hasId?'id':'en');
    }else{
      setWriteLang(post.contentId?'id':'en');
    }
    setView('write');
  };

  const handleDelete=async id=>await deleteDoc(doc(db,'bulletins',id));

  if(selectedPost){
    const cfg=catConfig[selectedPost.cat]||catConfig.announcement;
    const dispContent=lang==='id'?(selectedPost.contentId||selectedPost.content):(selectedPost.content||selectedPost.contentId);
    const catItems=bulletins.filter(b=>{
      if(b.cat!==selectedPost.cat) return false;
      if(selectedPost.cat==='devotional') return (b.subType||'general')===(selectedPost.subType||'general');
      return true;
    }).sort((a,b)=>{
      if((selectedPost.subType||'general')==='daily_devotional'){
        const order={mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6};
        const ao=order[a.dayOfWeek]??99, bo=order[b.dayOfWeek]??99;
        if(ao!==bo) return ao-bo;
        return new Date(b.timestamp)-new Date(a.timestamp);
      }
      if(a.eventDate&&b.eventDate) return a.eventDate.localeCompare(b.eventDate);
      if(a.eventDate&&!b.eventDate) return -1;
      if(!a.eventDate&&b.eventDate) return 1;
      return new Date(b.timestamp)-new Date(a.timestamp);
    });
    const idx=catItems.findIndex(b=>b.id===selectedPost.id);
    return(
      <div id="bulletin-detail-scroll" style={S.screen}>
        <div style={{backgroundColor:(selectedPost.cat==='devotional'&&devSubConfig[selectedPost.subType||'general'])?devSubConfig[selectedPost.subType||'general'].color:cfg.color,padding:'20px 20px 24px',borderRadius:24,margin:16,marginBottom:0}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div onClick={()=>{setSelectedPost(null);if(selectedPost?.subType==='reading_plan')setSelectedSubType(null);}} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}>
              <span style={{color:'rgba(255,255,255,0.8)',fontSize:16}}>←</span>
              <span style={{color:'rgba(255,255,255,0.8)',fontSize:14,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
            </div>
            {selectedPost.subType!=='reading_plan'&&(
            <div style={{display:'flex',gap:8}}>
              {idx>0&&<div onClick={()=>setSelectedPost(catItems[idx-1])} style={{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,padding:'4px 10px',cursor:'pointer',color:'white',fontSize:14}}>‹</div>}
              {idx<catItems.length-1&&<div onClick={()=>setSelectedPost(catItems[idx+1])} style={{backgroundColor:'rgba(255,255,255,0.2)',borderRadius:20,padding:'4px 10px',cursor:'pointer',color:'white',fontSize:14}}>›</div>}
            </div>
            )}
          </div>
          {selectedPost.subType==='daily_devotional'&&selectedPost.dayOfWeek&&<div style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:700,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{({mon:lang==='id'?'Senin':'Monday',tue:lang==='id'?'Selasa':'Tuesday',wed:lang==='id'?'Rabu':'Wednesday',thu:lang==='id'?'Kamis':'Thursday',fri:lang==='id'?'Jumat':'Friday',sat:lang==='id'?'Sabtu':'Saturday',sun:lang==='id'?'Minggu':'Sunday'})[selectedPost.dayOfWeek]}</div>}
          {selectedPost.subType==='reading_plan'?(
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:60,height:60,borderRadius:30,backgroundColor:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,flexShrink:0}}>📖</div>
              <div>
                <div style={{color:'white',fontSize:24,fontWeight:800}}>{lang==='id'?'Rencana Baca Alkitab':'Bible Reading Plan'}</div>
                <div style={{color:'rgba(255,255,255,0.7)',fontSize:13}}>{selectedPost.title||(lang==='id'?'Rencana baca Alkitab mingguan':'Weekly Bible reading plan')}</div>
              </div>
            </div>
          ):(
            <div style={{color:'white',fontSize:22,fontWeight:800,lineHeight:1.4}}>{(lang==='id'?(selectedPost.titleId||selectedPost.title):(selectedPost.title||selectedPost.titleId))||dispContent?.slice(0,40)}</div>
          )}
          {selectedPost.subType!=='reading_plan'&&<div style={{color:'rgba(255,255,255,0.6)',fontSize:12,marginTop:8}}>{idx+1}/{catItems.length}</div>}
        </div>
        <div style={{padding:20}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,marginBottom:16}}>
            <span style={{fontSize:11,color:th.textMid,fontWeight:600,marginRight:4}}>{lang==='id'?'Ukuran Teks':'Text Size'}</span>
            <button onClick={()=>setFontSize(f=>Math.max(12,f-2))} style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${th.border}`,backgroundColor:'white',cursor:'pointer',fontSize:12,fontWeight:700,color:th.textMid}}>A-</button>
            <button onClick={()=>setFontSize(15)} style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${th.border}`,backgroundColor:'white',cursor:'pointer',fontSize:14,fontWeight:700,color:th.textMid}}>A</button>
            <button onClick={()=>setFontSize(f=>Math.min(24,f+2))} style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${th.border}`,backgroundColor:'white',cursor:'pointer',fontSize:18,fontWeight:700,color:th.textMid}}>A+</button>
          </div>
          {selectedPost.imageUrl&&<img src={selectedPost.imageUrl} alt="" style={{width:'100%',borderRadius:14,marginBottom:16,display:'block'}}/>}
          {selectedPost.subType==='reading_plan'?(
            <div style={{fontSize:fontSize,color:th.text,marginBottom:20,textAlign:selectedPost.textAlign||'left'}}>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Senin':'Mon'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.mon?.[lang]||'-'}</div>
              </div>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Selasa':'Tue'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.tue?.[lang]||'-'}</div>
              </div>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Rabu':'Wed'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.wed?.[lang]||'-'}</div>
              </div>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Kamis':'Thu'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.thu?.[lang]||'-'}</div>
              </div>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Jumat':'Fri'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.fri?.[lang]||'-'}</div>
              </div>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Sabtu':'Sat'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.sat?.[lang]||'-'}</div>
              </div>
              <div style={{marginBottom:14,paddingBottom:14,borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:12,fontWeight:700,color:th.accent,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>{lang==='id'?'Minggu':'Sun'}</div>
                <div style={{fontSize:fontSize,color:th.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{selectedPost.weekDays?.sun?.[lang]||'-'}</div>
              </div>
            </div>
          ):(
            <div style={{fontSize:fontSize,color:th.text,lineHeight:1.9,marginBottom:20,whiteSpace:'pre-wrap',textAlign:selectedPost.textAlign||'left'}}>
              {dispContent?.split(/(\*\*[^*]+\*\*)/g).map((part,i)=>{
                if(part.startsWith('**')&&part.endsWith('**')){
                  return <strong key={i}>{part.slice(2,-2)}</strong>;
                }
                if(selectedPost.cat==='event'){
                  return <React.Fragment key={i}>{part.split(/(https?:\/\/[^\s]+|www\.[^\s]+)/g).map((seg,j)=>{
                    if(/^(https?:\/\/|www\.)/.test(seg)){
                      const href=seg.startsWith('www.')?`https://${seg}`:seg;
                      return <a key={j} href={href} target="_blank" rel="noreferrer" style={{color:th.primary,textDecoration:'underline'}}>{seg}</a>;
                    }
                    return <React.Fragment key={j}>{seg}</React.Fragment>;
                  })}</React.Fragment>;
                }
                return <React.Fragment key={i}>{part}</React.Fragment>;
              })}
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:16,borderTop:`1px solid ${th.border}`}}>
            <img src={LOGO_URL} style={{width:24,height:24,borderRadius:12,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
            <div><div style={{fontSize:13,fontWeight:700,color:th.primary}}>Bethel International Church</div><div style={{fontSize:11,color:th.textLight}}>Elmhurst, New York</div></div>
          </div>
          <button onClick={()=>{setSelectedPost(null);if(selectedPost?.subType==='reading_plan')setSelectedSubType(null);}} style={{width:'100%',marginTop:16,backgroundColor:cfg.bg,border:'none',borderRadius:14,padding:14,color:cfg.color,fontWeight:700,cursor:'pointer',fontSize:14}}>← {lang==='id'?'Kembali':'Back'}</button>
          {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&selectedPost.subType==='reading_plan'&&<button onClick={()=>handleEditClick(selectedPost)} style={{width:'100%',marginTop:10,backgroundColor:`${th.primary}10`,border:`1px solid ${th.primary}30`,borderRadius:14,padding:14,color:th.primary,fontWeight:700,cursor:'pointer',fontSize:14}}>✏️ {lang==='id'?'Edit Post':'Edit Post'}</button>}
          {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&<button onClick={async()=>{await handleDelete(selectedPost.id);setSelectedPost(null);if(selectedPost.subType==='reading_plan')setSelectedSubType(null);}} style={{width:'100%',marginTop:10,backgroundColor:'#fff0f0',border:`1px solid ${th.danger}30`,borderRadius:14,padding:14,color:th.danger,fontWeight:700,cursor:'pointer',fontSize:14}}>🗑 {lang==='id'?'Hapus Post':'Delete Post'}</button>}
          {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&selectedPost.subType==='reading_plan'&&<button onClick={async()=>{
            if(!window.confirm(lang==='id'?'Hapus SEMUA post Bible Reading Plan? Tindakan ini tidak bisa dibatalkan.':'Delete ALL Bible Reading Plan posts? This cannot be undone.')) return;
            const items=bulletins.filter(b=>b.cat==='devotional'&&(b.subType||'general')==='reading_plan');
            await Promise.all(items.map(b=>deleteDoc(doc(db,'bulletins',b.id))));
            setSelectedPost(null);setSelectedSubType(null);
          }} style={{width:'100%',marginTop:10,backgroundColor:'#fff0f0',border:`1px solid ${th.danger}`,borderRadius:14,padding:14,color:th.danger,fontWeight:700,cursor:'pointer',fontSize:14}}>🗑 {lang==='id'?'Hapus Semua Reading Plan':'Clear All Reading Plan'}</button>}
          {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&selectedPost.subType==='daily_devotional'&&<button onClick={async()=>{
            if(!window.confirm(lang==='id'?'Hapus SEMUA post Daily Devotional? Tindakan ini tidak bisa dibatalkan.':'Delete ALL Daily Devotional posts? This cannot be undone.')) return;
            const items=bulletins.filter(b=>b.cat==='devotional'&&(b.subType||'general')==='daily_devotional');
            await Promise.all(items.map(b=>deleteDoc(doc(db,'bulletins',b.id))));
            setSelectedPost(null);setSelectedSubType(null);
          }} style={{width:'100%',marginTop:10,backgroundColor:'#fff0f0',border:`1px solid ${th.danger}`,borderRadius:14,padding:14,color:th.danger,fontWeight:700,cursor:'pointer',fontSize:14}}>🗑 {lang==='id'?'Hapus Semua Daily Devotional':'Clear All Daily Devotional'}</button>}
        </div>
        <button onClick={()=>{const el=document.getElementById('bulletin-detail-scroll');if(el)el.scrollTo({top:0,behavior:'smooth'});}}
          style={{position:'fixed',bottom:90,right:20,width:48,height:48,borderRadius:24,backgroundColor:cfg.color,border:'none',boxShadow:'0 4px 12px rgba(0,0,0,0.2)',cursor:'pointer',fontSize:20,color:'white',zIndex:50}}>
          ↑
        </button>
      </div>
    );
  }

  if(selectedCat==='devotional'&&!selectedSubType){
    return(
      <div style={S.screen}><div style={{padding:16}}>
        <div style={{backgroundColor:catConfig.devotional.color,padding:'20px 20px 24px',borderRadius:24,marginBottom:16}}>
          <div onClick={()=>setSelectedCat(null)} style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}}>
            <span style={{color:'rgba(255,255,255,0.8)',fontSize:16}}>←</span>
            <span style={{color:'rgba(255,255,255,0.8)',fontSize:14,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:60,height:60,borderRadius:30,backgroundColor:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>{catConfig.devotional.emoji}</div>
            <div><div style={{color:'white',fontSize:24,fontWeight:800}}>{catConfig.devotional.label}</div><div style={{color:'rgba(255,255,255,0.7)',fontSize:13}}>{catConfig.devotional.desc}</div></div>
          </div>
        </div>
        {Object.entries(devSubConfig).map(([key,cfg])=>(
          <div key={key} onClick={()=>{setSelectedSubType(key);setView('list');}}
            style={{backgroundColor:cfg.bg,borderRadius:22,padding:20,marginBottom:14,cursor:'pointer',boxShadow:`0 4px 10px ${cfg.color}25`,border:`1.5px solid ${cfg.color}25`}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:56,height:56,borderRadius:28,backgroundColor:`${cfg.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{cfg.emoji}</div>
                <div><div style={{fontSize:18,fontWeight:800,color:cfg.color}}>{cfg.label}</div><div style={{fontSize:12,color:`${cfg.color}99`,marginTop:2}}>{cfg.desc}</div></div>
              </div>
              <span style={{fontSize:22,color:cfg.color}}>›</span>
            </div>
          </div>
        ))}
      </div></div>
    );
  }

  if(selectedCat){
    const isDevotional = selectedCat==='devotional';
    const cfg=isDevotional?devSubConfig[selectedSubType]:catConfig[selectedCat];
    const items=bulletins.filter(b=>{
      if(b.cat!==selectedCat) return false;
      if(isDevotional) return (b.subType||'general')===selectedSubType;
      return true;
    }).sort((a,b)=>{
    if(selectedSubType==='daily_devotional'){
      const order={mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6};
      const ao=order[a.dayOfWeek]??99, bo=order[b.dayOfWeek]??99;
      if(ao!==bo) return ao-bo;
      return new Date(b.timestamp)-new Date(a.timestamp);
    }
    if(a.eventDate&&b.eventDate) return a.eventDate.localeCompare(b.eventDate);
    if(a.eventDate&&!b.eventDate) return -1;
    if(!a.eventDate&&b.eventDate) return 1;
    return new Date(b.timestamp)-new Date(a.timestamp);
  });

    return(
      <div style={S.screen}>
        <div style={{backgroundColor:cfg.color,padding:'20px 20px 24px',borderRadius:24,margin:16,marginBottom:0}}>
          <div onClick={()=>{if(isDevotional){setSelectedSubType(null);}else{setSelectedCat(null);}}} style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer'}}>
            <span style={{color:'rgba(255,255,255,0.8)',fontSize:16}}>←</span>
            <span style={{color:'rgba(255,255,255,0.8)',fontSize:14,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <div style={{width:60,height:60,borderRadius:30,backgroundColor:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>{cfg.emoji}</div>
            <div><div style={{color:'white',fontSize:24,fontWeight:800}}>{cfg.label}</div><div style={{color:'rgba(255,255,255,0.7)',fontSize:13}}>{cfg.desc}</div></div>
          </div>
        </div>
        <div style={{padding:16}}>
          {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&view!=='write'&&(
            <div onClick={()=>{if(isDevotional)setSubType(selectedSubType);setSelectedPost(null);setView('write');}} style={{border:`2px dashed ${cfg.color}40`,borderRadius:14,padding:14,marginBottom:14,display:'flex',alignItems:'center',justifyContent:'center',gap:8,cursor:'pointer',backgroundColor:cfg.bg}}>
              <span style={{fontSize:18}}>+</span><span style={{fontSize:14,fontWeight:700,color:cfg.color}}>{lang==='id'?'Tambah Posting':'Add Post'}</span>
            </div>
          )}
          {view==='write'&&(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&(
            <Card>
              <div onClick={()=>{setView('list');setEditingPost(null);setTitle('');setTitleId('');setContent('');setContentId('');setEventDate('');setTextAlign('left');setImageUrl('');setSubType('general');setWeekDays({mon:{en:'',id:''},tue:{en:'',id:''},wed:{en:'',id:''},thu:{en:'',id:''},fri:{en:'',id:''},sat:{en:'',id:''},sun:{en:'',id:''}});}} style={{color:th.primary,fontWeight:700,marginBottom:14,cursor:'pointer'}}>← {lang==='id'?'Kembali':'Back'}</div>
              <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Judul':'Title'}</label>
              <div style={{position:'relative',marginBottom:10}}>
                <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={lang==='id'?'Judul (English)...':'Title (English)...'} style={{...S.inp,marginBottom:0,paddingRight:36}}/>
                {title&&<span onClick={()=>setTitle('')} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',cursor:'pointer',color:th.textMid,fontSize:16,fontWeight:700}}>✕</span>}
              </div>
              <div style={{position:'relative',marginBottom:16}}>
                <input value={titleId} onChange={e=>setTitleId(e.target.value)} placeholder="Judul (Indonesia)..." style={{...S.inp,marginBottom:0,paddingRight:36}}/>
                {titleId&&<span onClick={()=>setTitleId('')} style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',cursor:'pointer',color:th.textMid,fontSize:16,fontWeight:700}}>✕</span>}
              </div>
              {subType==='reading_plan'&&(
                <div style={{marginBottom:16}}>
                  <div style={{display:'flex',marginBottom:14,borderRadius:14,overflow:'hidden',border:`2px solid ${th.border}`}}>
                    <button onClick={()=>setWriteLang('id')} style={{flex:1,padding:'12px',border:'none',backgroundColor:writeLang==='id'?th.primary:'white',color:writeLang==='id'?'white':th.textMid,fontWeight:700,fontSize:13,cursor:'pointer'}}>🇮🇩 Indonesia</button>
                    <button onClick={()=>setWriteLang('en')} style={{flex:1,padding:'12px',border:'none',backgroundColor:writeLang==='en'?th.primary:'white',color:writeLang==='en'?'white':th.textMid,fontWeight:700,fontSize:13,cursor:'pointer'}}>🇺🇸 English</button>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Senin':'Mon'}</label>
                    <input value={weekDays.mon?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,mon:{...w.mon,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Selasa':'Tue'}</label>
                    <input value={weekDays.tue?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,tue:{...w.tue,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Rabu':'Wed'}</label>
                    <input value={weekDays.wed?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,wed:{...w.wed,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Kamis':'Thu'}</label>
                    <input value={weekDays.thu?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,thu:{...w.thu,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Jumat':'Fri'}</label>
                    <input value={weekDays.fri?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,fri:{...w.fri,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Sabtu':'Sat'}</label>
                    <input value={weekDays.sat?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,sat:{...w.sat,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                  <div style={{marginBottom:12}}>
                    <label style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:4,display:'block'}}>{lang==='id'?'Minggu':'Sun'}</label>
                    <input value={weekDays.sun?.[writeLang]||''} onChange={e=>setWeekDays(w=>({...w,sun:{...w.sun,[writeLang]:e.target.value}}))} placeholder={lang==='id'?'Referensi ayat (mis. Matius 5:1-12)':'Bible reference (e.g. Matthew 5:1-12)'} style={{...S.inp}}/>
                  </div>
                </div>
              )}
              {subType==='daily_devotional'&&(
                <>
                  <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Hari':'Day'}</label>
                  <select value={dayOfWeek} onChange={e=>setDayOfWeek(e.target.value)} style={{...S.inp,marginBottom:16}}>
                    <option value="mon">{lang==='id'?'Senin':'Monday'}</option>
                    <option value="tue">{lang==='id'?'Selasa':'Tuesday'}</option>
                    <option value="wed">{lang==='id'?'Rabu':'Wednesday'}</option>
                    <option value="thu">{lang==='id'?'Kamis':'Thursday'}</option>
                    <option value="fri">{lang==='id'?'Jumat':'Friday'}</option>
                    <option value="sat">{lang==='id'?'Sabtu':'Saturday'}</option>
                    <option value="sun">{lang==='id'?'Minggu':'Sunday'}</option>
                  </select>
                </>
              )}
              {selectedCat==='event'&&(
                <>
                  <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Tanggal Acara':'Event Date'}</label>
                  <input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)} style={{...S.inp,marginBottom:16,WebkitAppearance:"none",appearance:"none",width:"100%",boxSizing:"border-box"}}/>
                </>
              )}
              <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Gambar/Flyer (Opsional)':'Image/Flyer (Optional)'}</label>
              {imageUrl?(
                <div style={{position:'relative',marginBottom:14}}>
                  <img src={imageUrl} alt="preview" style={{width:'100%',borderRadius:14,display:'block'}}/>
                  <button onClick={()=>setImageUrl('')} style={{position:'absolute',top:8,right:8,backgroundColor:'rgba(0,0,0,0.6)',border:'none',borderRadius:20,width:32,height:32,color:'white',fontSize:16,cursor:'pointer'}}>✕</button>
                </div>
              ):(
                <label style={{display:'block',border:`2px dashed ${th.border}`,borderRadius:14,padding:24,textAlign:'center',cursor:'pointer',marginBottom:14,color:th.textMid,fontSize:13}}>
                  {uploading?(lang==='id'?'Mengupload...':'Uploading...'):(lang==='id'?'📷 Tap untuk upload gambar':'📷 Tap to upload image')}
                  <input type="file" accept="image/*" style={{display:'none'}} onChange={async(e)=>{
                    const file=e.target.files[0];
                    if(!file)return;
                    setUploading(true);
                    try{
                      const ref=storageRef(storage,`bulletins/${Date.now()}_${file.name}`);
                      await uploadBytes(ref,file);
                      const url=await getDownloadURL(ref);
                      setImageUrl(url);
                    }catch(err){
                      alert('Upload failed: '+err.message);
                    }
                    setUploading(false);
                  }}/>
                </label>
              )}
              <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Perataan Teks':'Text Alignment'}</label>
              <div style={{display:'flex',gap:8,marginBottom:14}}>
                <button onClick={()=>setTextAlign('left')} style={{flex:1,padding:'8px',borderRadius:10,border:`1.5px solid ${textAlign==='left'?th.primary:th.border}`,backgroundColor:textAlign==='left'?`${th.primary}15`:'white',color:textAlign==='left'?th.primary:th.textMid,fontSize:13,fontWeight:700,cursor:'pointer'}}>⬅ {lang==='id'?'Kiri':'Left'}</button>
                <button onClick={()=>setTextAlign('center')} style={{flex:1,padding:'8px',borderRadius:10,border:`1.5px solid ${textAlign==='center'?th.primary:th.border}`,backgroundColor:textAlign==='center'?`${th.primary}15`:'white',color:textAlign==='center'?th.primary:th.textMid,fontSize:13,fontWeight:700,cursor:'pointer'}}>↔ {lang==='id'?'Tengah':'Center'}</button>
              </div>
              <div style={{display:'flex',marginBottom:14,borderRadius:14,overflow:'hidden',border:`2px solid ${th.border}`}}>
                <button onClick={()=>setWriteLang('id')} style={{flex:1,padding:'12px',border:'none',backgroundColor:writeLang==='id'?th.primary:'white',color:writeLang==='id'?'white':th.textMid,fontWeight:700,fontSize:13,cursor:'pointer'}}>🇮🇩 Indonesia</button>
                <button onClick={()=>setWriteLang('en')} style={{flex:1,padding:'12px',border:'none',backgroundColor:writeLang==='en'?th.primary:'white',color:writeLang==='en'?'white':th.textMid,fontWeight:700,fontSize:13,cursor:'pointer'}}>🇺🇸 English</button>
              </div>
              {subType!=='reading_plan'&&(
                writeLang==='id'?<><label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>Konten Indonesia 🇮🇩</label><div style={{position:'relative'}}><textarea value={contentId} onChange={e=>setContentId(e.target.value)} placeholder="Tulis konten..." rows={6} style={{...S.inp,height:160,resize:'vertical',marginBottom:16,paddingRight:36}}/>{contentId&&<span onClick={()=>setContentId('')} style={{position:'absolute',right:12,top:10,cursor:'pointer',color:th.textMid,fontSize:16,fontWeight:700}}>✕</span>}</div></>
              :<><label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>English Content 🇺🇸</label><div style={{position:'relative'}}><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Write content..." rows={6} style={{...S.inp,height:160,resize:'vertical',marginBottom:16,paddingRight:36}}/>{content&&<span onClick={()=>setContent('')} style={{position:'absolute',right:12,top:10,cursor:'pointer',color:th.textMid,fontSize:16,fontWeight:700}}>✕</span>}</div></>
              )}

              <Btn label={editingPost?(lang==='id'?'Update':'Update'):(lang==='id'?'Publikasikan':'Publish')} onClick={handleSave} disabled={subType!=='reading_plan'&&!content&&!contentId}/>
            </Card>
          )}
          {items.length===0?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:48,marginBottom:16}}>{cfg.emoji}</div><div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Belum ada postingan':'No posts yet'}</div></div>
          :items.map(b=>{
            const dispContent=lang==='id'?(b.contentId||b.content):(b.content||b.contentId);
            return(
              <div key={b.id} style={{backgroundColor:'white',borderRadius:18,marginBottom:10,padding:16,boxShadow:'0 2px 6px rgba(0,0,0,0.05)',borderLeft:`4px solid ${cfg.color}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div onClick={()=>setSelectedPost(b)} style={{flex:1,cursor:'pointer'}}>
                  <div style={{fontSize:15,fontWeight:700}}>
                    {b.subType==='daily_devotional'&&b.dayOfWeek&&<span style={{color:th.accent}}>{({mon:lang==='id'?'Senin':'Mon',tue:lang==='id'?'Selasa':'Tue',wed:lang==='id'?'Rabu':'Wed',thu:lang==='id'?'Kamis':'Thu',fri:lang==='id'?'Jumat':'Fri',sat:lang==='id'?'Sabtu':'Sat',sun:lang==='id'?'Minggu':'Sun'})[b.dayOfWeek]} - </span>}
                    {(lang==='id'?(b.titleId||b.title):(b.title||b.titleId))||dispContent?.slice(0,60)}
                  </div>
                </div>
                {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&<button onClick={()=>handleEditClick(b)} style={{backgroundColor:`${th.primary}10`,border:'none',borderRadius:10,padding:'6px 10px',color:th.primary,fontSize:11,fontWeight:700,cursor:'pointer',marginLeft:8}}>✏️</button>}
                {(user.role==='admin'||(user.role==='leader'&&lp.bulletin))&&<button onClick={()=>handleDelete(b.id)} style={{backgroundColor:'#fff0f0',border:'none',borderRadius:10,padding:'6px 10px',color:th.danger,fontSize:11,fontWeight:700,cursor:'pointer',marginLeft:8}}>🗑</button>}
                <span onClick={()=>setSelectedPost(b)} style={{fontSize:20,color:cfg.color,marginLeft:8,cursor:'pointer'}}>›</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Warta Jemaat':'Church Bulletin'}</div>
      </div>
      {Object.entries(catConfig).map(([key,cfg])=>(
        <div key={key} onClick={()=>{setSelectedCat(key);setView('list');}}
          style={{backgroundColor:cfg.bg,borderRadius:22,padding:20,marginBottom:14,cursor:'pointer',boxShadow:`0 4px 10px ${cfg.color}25`,border:`1.5px solid ${cfg.color}25`}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:56,height:56,borderRadius:28,backgroundColor:`${cfg.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{cfg.emoji}</div>
              <div><div style={{fontSize:18,fontWeight:800,color:cfg.color}}>{cfg.label}</div><div style={{fontSize:12,color:`${cfg.color}99`,marginTop:2}}>{cfg.desc}</div></div>
            </div>
            <span style={{fontSize:22,color:cfg.color}}>›</span>
          </div>
        </div>
      ))}
    </div></div>
  );
};

const RequestScreen=({user,lang,lp={},onNav})=>{
  const [view,setView]=useState('list');
  const [reqType,setReqType]=useState('baptism');
  const [reqNote,setReqNote]=useState('');
  const [reqPhone,setReqPhone]=useState('');
  const [bulanPelayanan,setBulanPelayanan]=useState('');
  const [requests,setRequests]=useState([]);

  const reqTypes=[
    {key:'baptism',label:lang==='id'?'Baptisan':'Baptism',emoji:'💧'},
    {key:'dedication',label:lang==='id'?'Penyerahan Anak':'Child Dedication',emoji:'👶'},
    {key:'wedding',label:lang==='id'?'Pernikahan':'Wedding',emoji:'💍'},
    {key:'counseling',label:lang==='id'?'Konseling':'Counseling',emoji:'🤝'},
    {key:'prayer',label:lang==='id'?'Doa Khusus':'Special Prayer',emoji:'🙏'},
    {key:'pelayanan',label:lang==='id'?'Permohonan Pelayanan':'Service Request',emoji:'🙏'},
    {key:'other',label:lang==='id'?'Lainnya':'Other',emoji:'📋'},
  ];

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'requests'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      setRequests((user.role==='admin'||(user.role==='leader'&&lp.approveRequest))?all:all.filter(r=>r.userId===user.uid));
    });
    return unsub;
  },[user.uid,user.role]);

  const handleSubmit=async()=>{
    if(!reqPhone)return;
    const rt=reqTypes.find(r=>r.key===reqType);
    await addDoc(collection(db,'requests'),{userId:user.uid,userName:user.name,userPhone:reqPhone,userEmail:user.email,type:reqType,typeLabel:rt?.label,typeEmoji:rt?.emoji,note:reqNote,bulanPelayanan,status:'pending',date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
    await addDoc(collection(db,'notifications'),{type:'new_request',userName:user.name,userEmail:user.email,reqType:rt?.label,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),readBy:[]});
    setReqNote('');setBulanPelayanan('');setView('list');
  };

  const handleStatus=async(id,status)=>await updateDoc(doc(db,'requests',id),{status});
  const statusColor=s=>s==='approved'?th.success:s==='rejected'?th.danger:th.warning;
  const statusLabel=s=>s==='approved'?(lang==='id'?'Disetujui':'Approved'):s==='rejected'?(lang==='id'?'Ditolak':'Rejected'):(lang==='id'?'Menunggu':'Pending');

  if(view==='add') return(
    <div style={S.screen}><div style={{padding:16}}>
      <div onClick={()=>setView('list')} style={{display:'flex',alignItems:'center',gap:8,marginBottom:20,cursor:'pointer',color:th.primary,fontWeight:700,fontSize:15}}>← {lang==='id'?'Kembali':'Back'}</div>
      <div style={{fontSize:18,fontWeight:800,marginBottom:16}}>{lang==='id'?'Buat Permohonan':'New Request'}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {reqTypes.map(rt=>(
          <button key={rt.key} onClick={()=>setReqType(rt.key)}
            style={{padding:'8px 14px',borderRadius:20,border:`2px solid ${reqType===rt.key?th.primary:th.border}`,backgroundColor:reqType===rt.key?`${th.primary}15`:'white',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:reqType===rt.key?th.primary:th.textMid}}>
            {rt.emoji} {rt.label}
          </button>
        ))}
      </div>
      <Inp label={lang==='id'?'No. HP':'Phone'} value={reqPhone} onChange={setReqPhone} placeholder="+1 234 567 8900" type="tel"/>
      {reqType==='pelayanan'&&(
        <>
          <Inp label={lang==='id'?'Bulan Pelayanan yang Diminta':'Requested Service Month'} value={bulanPelayanan} onChange={setBulanPelayanan} placeholder="e.g. Juli 2026"/>
          {new Date().getDate()>15&&(
            <div style={{backgroundColor:'#fff8e8',borderRadius:12,padding:12,marginBottom:14,display:'flex',gap:8,alignItems:'center'}}>
              <span style={{fontSize:18}}>⚠️</span>
              <span style={{fontSize:12,color:th.warning,fontWeight:600}}>{lang==='id'?'Sudah lewat tanggal 15. Permohonan tetap bisa dikirim, namun bisa diproses bulan berikutnya.':'Past the 15th deadline. Request can still be submitted but may be processed next month.'}</span>
            </div>
          )}
        </>
      )}
      <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Catatan':'Notes'}</label>
      <textarea value={reqNote} onChange={e=>setReqNote(e.target.value)} placeholder={lang==='id'?'Keterangan tambahan...':'Additional notes...'} rows={4} style={{...S.inp,height:120,resize:'vertical',marginBottom:16}}/>
      <Btn label={lang==='id'?'Kirim Permohonan':'Submit Request'} onClick={handleSubmit} disabled={!reqPhone}/>
    </div></div>
  );

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}} onClick={()=>onNav&&onNav('home')}>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:15}}>←</span>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Permohonan':'Requests'}</div><div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:2}}>{requests.length} {lang==='id'?'permohonan':'requests'}</div></div>
          <button onClick={()=>setView('add')} style={{backgroundColor:th.accent,border:'none',borderRadius:20,padding:'7px 14px',color:th.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>+ {lang==='id'?'Buat':'New'}</button>
        </div>
      </div>
      {requests.length===0?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:48,marginBottom:16}}>📝</div><div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Belum ada permohonan':'No requests yet'}</div></div>
      :[...requests].reverse().map(r=>(
        <Card key={r.id}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <span style={{fontSize:24}}>{r.typeEmoji}</span>
              <div><div style={{fontSize:15,fontWeight:700}}>{r.typeLabel}</div><div style={{fontSize:11,color:th.textLight}}>{r.date}</div></div>
            </div>
            <div style={{backgroundColor:statusColor(r.status)+'20',borderRadius:20,padding:'4px 10px'}}>
              <span style={{fontSize:11,fontWeight:700,color:statusColor(r.status)}}>{statusLabel(r.status)}</span>
            </div>
          </div>
          {user.role==='admin'&&<div style={{backgroundColor:th.bg,borderRadius:12,padding:10,marginBottom:8,fontSize:12,color:th.textMid,lineHeight:1.8}}>
            👤 {r.userName}<br/>📧 {r.userEmail}<br/>📞 {r.userPhone}{r.bulanPelayanan&&<><br/>📅 {lang==='id'?'Bulan':'Month'}: {r.bulanPelayanan}</>}{r.note&&<><br/>📝 {r.note}</>}
          </div>}
          {(user.role==='admin'||(user.role==='leader'&&lp.approveRequest))&&r.status==='pending'&&<div style={{display:'flex',gap:8}}>
            <button onClick={()=>handleStatus(r.id,'approved')} style={{flex:1,backgroundColor:`${th.success}20`,border:`1px solid ${th.success}`,borderRadius:12,padding:'8px',color:th.success,fontWeight:700,cursor:'pointer',fontSize:13}}>✓ {lang==='id'?'Setujui':'Approve'}</button>
            <button onClick={()=>handleStatus(r.id,'rejected')} style={{flex:1,backgroundColor:`${th.danger}20`,border:`1px solid ${th.danger}`,borderRadius:12,padding:'8px',color:th.danger,fontWeight:700,cursor:'pointer',fontSize:13}}>✕ {lang==='id'?'Tolak':'Reject'}</button>
          </div>}
          {user.role==='admin'&&r.status==='rejected'&&<button onClick={async()=>await deleteDoc(doc(db,'requests',r.id))} style={{width:'100%',backgroundColor:'#fff0f0',border:'none',borderRadius:12,padding:'8px',color:th.danger,fontWeight:700,cursor:'pointer',fontSize:13}}>🗑 {lang==='id'?'Hapus':'Delete'}</button>}
        </Card>
      ))}
    </div></div>
  );
};

const VolunteerScreen=({user,lang,onNav})=>{
  const [myMinistries,setMyMinistries]=useState([]);
  const [saved,setSaved]=useState(false);
  const [allVolunteers,setAllVolunteers]=useState([]);

  const ministries=[
    {key:'worship',label:lang==='id'?'Worship':'Worship Team',emoji:'🎵'},
    {key:'music',label:lang==='id'?'Musik':'Music Team',emoji:'🎸'},
    {key:'multimedia',label:lang==='id'?'Multimedia':'Multimedia',emoji:'🎬'},
    {key:'usher',label:lang==='id'?'Penyambut Tamu':'Usher',emoji:'🤝'},
    {key:'children',label:lang==='id'?'Sekolah Minggu':'Children Ministry',emoji:'👶'},
    {key:'youth',label:lang==='id'?'Pemuda':'Youth Ministry',emoji:'🎉'},
    {key:'prayer',label:lang==='id'?'Tim Doa':'Prayer Team',emoji:'🙏'},
    {key:'decor',label:lang==='id'?'Dekorasi':'Decoration',emoji:'🌸'},
    {key:'tech',label:lang==='id'?'Teknisi':'Technical',emoji:'⚙️'},
    {key:'transport',label:lang==='id'?'Transportasi':'Transportation',emoji:'🚗'},
  ];

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'volunteers'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      setAllVolunteers(all);
      const mine=all.find(v=>v.userId===user.uid);
      if(mine)setMyMinistries(mine.ministries||[]);
    });
    return unsub;
  },[user.uid]);

  const toggleMinistry=key=>setMyMinistries(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);

  const handleSave=async()=>{
    const existing=allVolunteers.find(v=>v.userId===user.uid);
    const vol={userId:user.uid,userName:user.name,userPhone:user.phone||'-',userEmail:user.email,ministries:myMinistries,date:new Date().toLocaleDateString(),updatedAt:new Date().toISOString()};
    if(existing){await updateDoc(doc(db,'volunteers',existing.id),vol);}
    else{
      await addDoc(collection(db,'volunteers'),vol);
      await addDoc(collection(db,'notifications'),{type:'new_volunteer',userName:user.name,userEmail:user.email,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),readBy:[]});
    }
    setSaved(true);setTimeout(()=>setSaved(false),2500);
  };

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}} onClick={()=>onNav&&onNav('home')}>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:15}}>←</span>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
        </div>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Volunteer Pelayanan':'Ministry Volunteer'}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{lang==='id'?'Pilih bidang pelayananmu':'Select your ministry area'}</div>
      </div>
      {saved&&<div style={{backgroundColor:'#f0fff4',borderRadius:14,padding:12,marginBottom:14,display:'flex',gap:8,alignItems:'center'}}><span>✅</span><span style={{color:th.success,fontWeight:600}}>{lang==='id'?'Pelayanan tersimpan!':'Ministry saved!'}</span></div>}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:20}}>
        {ministries.map(m=>{
          const sel=myMinistries.includes(m.key);
          return(
            <div key={m.key} onClick={()=>toggleMinistry(m.key)}
              style={{backgroundColor:sel?`${th.primary}15`:'white',borderRadius:16,padding:14,border:`2px solid ${sel?th.primary:th.border}`,cursor:'pointer',display:'flex',alignItems:'center',gap:10}}>
              <span style={{fontSize:22}}>{m.emoji}</span>
              <span style={{fontSize:12,fontWeight:sel?700:400,color:sel?th.primary:th.textMid,flex:1}}>{m.label}</span>
              {sel&&<span style={{color:th.primary,fontWeight:700}}>✓</span>}
            </div>
          );
        })}
      </div>
      <Btn label={lang==='id'?'Simpan Pelayanan':'Save Ministry'} onClick={handleSave} disabled={myMinistries.length===0}/>
      {user.role==='admin'&&<div style={{marginTop:24}}>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>👥 {lang==='id'?'Daftar Volunteer':'Volunteer List'} ({allVolunteers.length})</div>
        {allVolunteers.length===0?<div style={{color:th.textMid,textAlign:'center',padding:20}}>{lang==='id'?'Belum ada':'None yet'}</div>
        :allVolunteers.map(v=>(
          <Card key={v.id}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <div style={{fontWeight:700}}>👤 {v.userName}</div>
              <div style={{fontSize:11,color:th.textLight}}>{v.date}</div>
            </div>
            <div style={{fontSize:12,color:th.textMid,marginBottom:8}}>📞 {v.userPhone} · 📧 {v.userEmail}</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {(v.ministries||[]).map(mk=>{
                const mn=ministries.find(m=>m.key===mk);
                return mn?<span key={mk} style={{backgroundColor:`${th.primary}15`,borderRadius:20,padding:'4px 10px',fontSize:11,color:th.primary,fontWeight:600}}>{mn.emoji} {mn.label}</span>:null;
              })}
            </div>
            <button onClick={async()=>await deleteDoc(doc(db,'volunteers',v.id))} style={{marginTop:10,backgroundColor:'#fff0f0',border:'none',borderRadius:10,padding:'4px 12px',color:th.danger,fontSize:11,fontWeight:700,cursor:'pointer'}}>🗑 Delete</button>
          </Card>
        ))}
      </div>}
    </div></div>
  );
};

const ReportScreen=({user,lang,lp={},onNav})=>{
  const [donations,setDonations]=useState([]);
  const [showSummary,setShowSummary]=useState(false);
  const [view,setView]=useState('list');
  const [title,setTitle]=useState('');
  const [content,setContent]=useState('');
  const [type,setType]=useState('activity');
  const [periode,setPeriode]=useState('');
  const [mentor,setMentor]=useState('');
  const [mentee,setMentee]=useState('');
  const [tempatWaktu,setTempatWaktu]=useState('');
  const [actNote,setActNote]=useState('');
  // Ministry/COOL fields
  const [coolNumber,setCoolNumber]=useState('');
  const [minTanggal,setMinTanggal]=useState('');
  const [minTempat,setMinTempat]=useState('');
  const [coolLeader,setCoolLeader]=useState('');
  const [worshipLeader,setWorshipLeader]=useState('');
  const [sharingFirman,setSharingFirman]=useState('');
  const [topikSharing,setTopikSharing]=useState('');
  const [jumlahPersembahan,setJumlahPersembahan]=useState('');
  const [penghitung1,setPenghitung1]=useState('');
  const [penghitung2,setPenghitung2]=useState('');
  const [jumlahHadir,setJumlahHadir]=useState('');
  const [minNotes,setMinNotes]=useState('');
  const [jamMulai,setJamMulai]=useState('');
  const [jamSelesai,setJamSelesai]=useState('');
  const [attendeeNames,setAttendeeNames]=useState(Array.from({length:20},(_,i)=>`${i+1}. `).join('\n'));
  const [reports,setReports]=useState([]);
  const types=lang==='id'?{activity:'Mentor',finance:'Keuangan',ministry:'Pelayanan',other:'Lainnya'}:{activity:'Mentor',finance:'Finance',ministry:'Ministry',other:'Other'};

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'reports'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      setReports(user.role==='admin'?all:all.filter(r=>r.userId===user.uid));
    });
    return unsub;
  },[user.uid,user.role]);

  useEffect(()=>{
    if(user.role!=='admin')return;
    const unsub=onSnapshot(collection(db,'donations'),snap=>{
      setDonations(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[user.role]);

  // Build summaries
  const activityReports=reports.filter(r=>r.type==='activity');
  const mentorSummary={};
  activityReports.forEach(r=>{
    const m=r.mentor||'(Unknown)';
    mentorSummary[m]=(mentorSummary[m]||0)+1;
  });

  const ministryReports=reports.filter(r=>r.type==='ministry');

  const financeByMonth={};
  const financeByCategory={};
  donations.forEach(d=>{
    const dt=new Date(d.timestamp);
    const monthKey=`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
    financeByMonth[monthKey]=(financeByMonth[monthKey]||0)+(d.amount||0);
    const cat=d.category||'other';
    financeByCategory[cat]=(financeByCategory[cat]||0)+(d.amount||0);
  });
  const totalDonations=donations.reduce((sum,d)=>sum+(d.amount||0),0);

  const handleSubmit=async()=>{
    if(type==='activity'){
      if(!periode||!mentor||!mentee)return;
      await addDoc(collection(db,'reports'),{userId:user.uid,userName:user.name,title:`Laporan Kegiatan - ${periode}`,type,periode,mentor,mentee,tempatWaktu,note:actNote,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
      await addDoc(collection(db,'notifications'),{type:'new_report',userName:user.name,userEmail:user.email,reportType:'Activity',date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),readBy:[]});
      setPeriode('');setMentor('');setMentee('');setTempatWaktu('');setActNote('');
    }else{
      if(!title||!content)return;
      await addDoc(collection(db,'reports'),{userId:user.uid,userName:user.name,title,content,type,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
      await addDoc(collection(db,'notifications'),{type:'new_report',userName:user.name,userEmail:user.email,reportType:types[type]||type,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),readBy:[]});
      setTitle('');setContent('');
    }
    setView('list');
  };

  if(view==='write') return(
    <div style={S.screen}><div style={{padding:16}}>
      <div onClick={()=>setView('list')} style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer',color:th.primary,fontWeight:700}}>← {lang==='id'?'Kembali':'Back'}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {Object.entries(types).map(([k,v])=>(<button key={k} onClick={()=>setType(k)} style={{padding:'8px 14px',borderRadius:12,border:`2px solid ${type===k?th.primary:th.border}`,backgroundColor:type===k?`${th.primary}10`:'white',cursor:'pointer',fontSize:13,fontWeight:600,color:type===k?th.primary:th.textMid}}>{v}</button>))}
      </div>
      {type==='activity'?(
        <>
          <div style={{fontSize:18,fontWeight:800,color:th.text,marginBottom:16}}>{lang==='id'?'Laporan Mentor':'Mentor Report'}</div>
          <Inp label={lang==='id'?'Periode':'Period'} value={periode} onChange={setPeriode} placeholder="e.g. Juni 2026"/>
          <Inp label="Mentor" value={mentor} onChange={setMentor} placeholder={lang==='id'?'Nama mentor...':'Mentor name...'}/>
          <Inp label="Mentee" value={mentee} onChange={setMentee} placeholder={lang==='id'?'Nama mentee...':'Mentee name...'}/>
          <Inp label={lang==='id'?'Tempat - Waktu':'Place - Time'} value={tempatWaktu} onChange={setTempatWaktu} placeholder={lang==='id'?'e.g. Gereja, 14:00':'e.g. Church, 2:00 PM'}/>
          <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>Note</label>
          <textarea value={actNote} onChange={e=>setActNote(e.target.value)} placeholder={lang==='id'?'Catatan kegiatan...':'Activity notes...'} rows={5} style={{...S.inp,height:140,resize:'vertical',marginBottom:16}}/>
          <Btn label={lang==='id'?'Kirim Laporan':'Submit Report'} onClick={handleSubmit} disabled={!periode||!mentor||!mentee}/>
        </>
      ):type==='ministry'?(
        <>
          <div style={{fontSize:18,fontWeight:800,color:th.text,marginBottom:16}}>{lang==='id'?'Laporan COOL':'COOL Report'}</div>
          <Inp label="COOL #" value={coolNumber} onChange={setCoolNumber} placeholder="e.g. 10"/>
          <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Tanggal':'Date'}</label>
          <input type="date" value={minTanggal} onChange={e=>setMinTanggal(e.target.value)} style={{...S.inp,marginBottom:14,WebkitAppearance:"none",appearance:"none",width:"100%",boxSizing:"border-box"}}/>
          <Inp label={lang==='id'?'Tempat':'Place'} value={minTempat} onChange={setMinTempat} placeholder="Online / Offline"/>
          <Inp label="COOL Leader" value={coolLeader} onChange={setCoolLeader} placeholder={lang==='id'?'Nama leader...':'Leader name...'}/>
          <Inp label="Worship Leader" value={worshipLeader} onChange={setWorshipLeader} placeholder={lang==='id'?'Nama worship leader...':'Worship leader name...'}/>
          <Inp label={lang==='id'?'Sharing Firman':'Word Sharing'} value={sharingFirman} onChange={setSharingFirman} placeholder={lang==='id'?'Nama pembicara...':'Speaker name...'}/>
          <Inp label={lang==='id'?'Topik Sharing Firman':'Sharing Topic'} value={topikSharing} onChange={setTopikSharing} placeholder={lang==='id'?'Topik...':'Topic...'}/>
          <Inp label={lang==='id'?'Jumlah Persembahan ($)':'Offering Amount ($)'} value={jumlahPersembahan} onChange={setJumlahPersembahan} placeholder="0" type="number"/>
          <Inp label="Penghitung 1" value={penghitung1} onChange={setPenghitung1} placeholder={lang==='id'?'Nama...':'Name...'}/>
          <Inp label="Penghitung 2" value={penghitung2} onChange={setPenghitung2} placeholder={lang==='id'?'Nama...':'Name...'}/>
          <Inp label={lang==='id'?'Jumlah yang Hadir':'Attendance Count'} value={jumlahHadir} onChange={setJumlahHadir} placeholder="0" type="number"/>
          <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Nama-nama yang Hadir':'Attendees Names'}</label>
          <textarea value={attendeeNames} onChange={e=>setAttendeeNames(e.target.value)} placeholder={lang==='id'?'1. Nama A\n2. Nama B\n3. Nama C\n...':'1. Name A\n2. Name B\n3. Name C\n...'} rows={6} style={{...S.inp,height:150,resize:'vertical',marginBottom:16}}/>
          <Inp label={lang==='id'?'Jam Mulai':'Start Time'} value={jamMulai} onChange={setJamMulai} placeholder="08:00 AM"/>
          <Inp label={lang==='id'?'Jam Selesai':'End Time'} value={jamSelesai} onChange={setJamSelesai} placeholder="09:10 AM"/>
          <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>Notes</label>
          <textarea value={minNotes} onChange={e=>setMinNotes(e.target.value)} placeholder={lang==='id'?'Catatan tambahan (New, Visitor, dll)...':'Additional notes (New, Visitor, etc)...'} rows={4} style={{...S.inp,height:100,resize:'vertical',marginBottom:16}}/>
          <Btn label={lang==='id'?'Kirim Laporan':'Submit Report'} onClick={handleSubmit} disabled={!coolNumber&&!minTanggal&&!coolLeader}/>
        </>
      ):(
        <>
          <Inp label={lang==='id'?'Judul':'Title'} value={title} onChange={setTitle} placeholder={lang==='id'?'Judul...':'Title...'}/>
          <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Isi Laporan':'Content'}</label>
          <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={lang==='id'?'Tuliskan laporan...':'Write your report...'} rows={6} style={{...S.inp,height:160,resize:'vertical',marginBottom:16}}/>
          <Btn label={lang==='id'?'Kirim Laporan':'Submit Report'} onClick={handleSubmit} disabled={!title||!content}/>
        </>
      )}
    </div></div>
  );

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}} onClick={()=>onNav&&onNav('home')}>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:15}}>←</span>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div><div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Laporan':'Reports'}</div><div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{reports.length} {lang==='id'?'laporan':'reports'}</div></div>
          <button onClick={()=>setView('write')} style={{backgroundColor:th.accent,border:'none',borderRadius:20,padding:'8px 16px',color:th.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>{lang==='id'?'Buat':'Create'}</button>
        </div>
      </div>
      {(user.role==='admin'||(user.role==='leader'&&lp.schedule))&&(
        <button onClick={()=>setShowSummary(!showSummary)}
          style={{width:'100%',backgroundColor:`${th.accent}15`,border:`2px solid ${th.accent}`,borderRadius:14,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:700,color:th.primary,marginBottom:16}}>
          📊 {showSummary?(lang==='id'?'Sembunyikan Summary':'Hide Summary'):(lang==='id'?'Lihat Summary Report':'View Report Summary')}
        </button>
      )}

      {user.role==='admin'&&showSummary&&(
        <div style={{marginBottom:16}}>
          {/* Activity Summary */}
          <Card>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>📋 {lang==='id'?'Summary Aktivitas':'Activity Summary'}</div>
            <div style={{fontSize:12,color:th.textMid,marginBottom:10}}>{lang==='id'?'Total Laporan':'Total Reports'}: {activityReports.length}</div>
            {Object.keys(mentorSummary).length===0?(
              <div style={{color:th.textMid,fontSize:13,textAlign:'center',padding:10}}>{lang==='id'?'Belum ada data':'No data yet'}</div>
            ):Object.entries(mentorSummary).sort((a,b)=>b[1]-a[1]).map(([mentor,count])=>(
              <div key={mentor} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${th.border}`}}>
                <span style={{fontSize:13,color:th.text}}>👤 {mentor}</span>
                <span style={{fontSize:13,fontWeight:700,color:th.primary}}>{count} {lang==='id'?'laporan':'reports'}</span>
              </div>
            ))}
          </Card>

          {/* Finance Summary */}
          <Card>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>💰 {lang==='id'?'Summary Keuangan':'Finance Summary'}</div>
            <div style={{fontSize:18,fontWeight:800,color:th.success,marginBottom:12}}>${totalDonations.toFixed(2)} <span style={{fontSize:12,fontWeight:400,color:th.textMid}}>{lang==='id'?'total donasi':'total donations'}</span></div>
            {Object.keys(financeByMonth).length>0&&(
              <>
                <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:8,marginTop:12,textTransform:'uppercase'}}>{lang==='id'?'Per Bulan':'By Month'}</div>
                {Object.entries(financeByMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([month,total])=>(
                  <div key={month} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${th.border}`}}>
                    <span style={{fontSize:13,color:th.text}}>{month}</span>
                    <span style={{fontSize:13,fontWeight:700,color:th.success}}>${total.toFixed(2)}</span>
                  </div>
                ))}
              </>
            )}
            {Object.keys(financeByCategory).length>0&&(
              <>
                <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:8,marginTop:12,textTransform:'uppercase'}}>{lang==='id'?'Per Kategori':'By Category'}</div>
                {Object.entries(financeByCategory).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>(
                  <div key={cat} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${th.border}`}}>
                    <span style={{fontSize:13,color:th.text,textTransform:'capitalize'}}>{cat}</span>
                    <span style={{fontSize:13,fontWeight:700,color:th.success}}>${total.toFixed(2)}</span>
                  </div>
                ))}
              </>
            )}
            {donations.length===0&&<div style={{color:th.textMid,fontSize:13,textAlign:'center',padding:10}}>{lang==='id'?'Belum ada data donasi':'No donation data yet'}</div>}
          </Card>

          {/* Ministry Summary */}
          <Card>
            <div style={{fontSize:15,fontWeight:700,marginBottom:12}}>⛪ {lang==='id'?'Summary Pelayanan (COOL/CORE)':'Ministry Summary (COOL/CORE)'}</div>
            <div style={{fontSize:12,color:th.textMid,marginBottom:10}}>{lang==='id'?'Total Laporan':'Total Reports'}: {ministryReports.length}</div>
            {ministryReports.length===0?(
              <div style={{color:th.textMid,fontSize:13,textAlign:'center',padding:10}}>{lang==='id'?'Belum ada data':'No data yet'}</div>
            ):ministryReports.slice(0,10).map(r=>(
              <div key={r.id} style={{padding:'8px 0',borderBottom:`1px solid ${th.border}`}}>
                <div style={{fontSize:13,fontWeight:600}}>{r.title}</div>
                <div style={{fontSize:11,color:th.textLight}}>{r.date} · {r.userName}</div>
              </div>
            ))}
          </Card>
          <button onClick={()=>{
            let csv='ACTIVITY SUMMARY\n';
            csv+='Mentor,Total Reports\n';
            Object.entries(mentorSummary).forEach(([m,c])=>{ csv+='"'+m+'",'+c+'\n'; });
            csv+='\nFINANCE SUMMARY\n';
            csv+='Total Donations,$'+totalDonations.toFixed(2)+'\n\n';
            csv+='By Month\nMonth,Total\n';
            Object.entries(financeByMonth).forEach(([m,t])=>{ csv+=m+',$'+t.toFixed(2)+'\n'; });
            csv+='\nBy Category\nCategory,Total\n';
            Object.entries(financeByCategory).forEach(([cat,t])=>{ csv+=cat+',$'+t.toFixed(2)+'\n'; });
            csv+='\nMINISTRY SUMMARY\n';
            csv+='Total COOL/CORE Reports,'+ministryReports.length+'\n\n';
            csv+='Date,COOL,Leader,Attendance,Offering\n';
            ministryReports.forEach(r=>{ csv+=(r.minTanggal||r.date)+','+(r.coolNumber||'')+','+(r.coolLeader||'')+','+(r.jumlahHadir||'')+','+(r.jumlahPersembahan||'')+'\n'; });
            const blob=new Blob([csv],{type:'text/csv'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download='Bethel_Summary_'+new Date().toLocaleDateString('en-CA')+'.csv';
            a.click();
            URL.revokeObjectURL(url);
          }} style={{width:'100%',backgroundColor:`${th.success}10`,border:`2px solid ${th.success}`,borderRadius:14,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:700,color:th.success,marginBottom:16}}>
            📊 {lang==='id'?'Export Summary ke Excel':'Export Summary to Excel'}
          </button>
        </div>
      )}

      {user.role==='admin'&&reports.length>0&&(
        <button onClick={()=>{
          const headers=['Date','Type','Title','Periode','Mentor','Mentee','Tempat-Waktu','Note','Content','By'];
          const rows=reports.map(r=>[r.date,r.type,r.title||'',r.periode||'',r.mentor||'',r.mentee||'',r.tempatWaktu||'',r.note||'',r.content||'',r.userName]);
          const csv=[headers,...rows].map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
          const blob=new Blob([csv],{type:'text/csv'});
          const url=URL.createObjectURL(blob);
          const a=document.createElement('a');
          a.href=url;
          a.download=`Bethel_Reports_${new Date().toLocaleDateString('en-CA')}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        }} style={{width:'100%',backgroundColor:`${th.primary}10`,border:`2px solid ${th.primary}`,borderRadius:14,padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,fontSize:14,fontWeight:700,color:th.primary,marginBottom:16}}>
          <span style={{fontSize:24}}>📊</span>
          <div style={{textAlign:'left'}}>
            <div>{lang==='id'?'Export Semua Laporan':'Export All Reports'}</div>
            <div style={{fontSize:11,fontWeight:400,color:th.textMid,marginTop:2}}>{lang==='id'?'Download CSV untuk dianalisa':'Download CSV for analysis'}</div>
          </div>
          <span style={{marginLeft:'auto',fontSize:18}}>↓</span>
        </button>
      )}
      {reports.length===0?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:48,marginBottom:16}}>📄</div><div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Belum Ada Laporan':'No Reports Yet'}</div></div>
      :[...reports].reverse().map(r=>(
        <Card key={r.id}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <div><div style={{fontSize:15,fontWeight:700,marginBottom:5}}>{r.title}</div><span style={{backgroundColor:th.bg,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,color:th.textMid}}>{types[r.type]||r.type}</span></div>
            <span style={{fontSize:11,color:th.textLight}}>{r.date}</span>
          </div>
          {r.type==='activity'?(
            <div style={{fontSize:13,color:th.textMid,lineHeight:2,marginTop:8}}>
              <div><strong>{lang==='id'?'Periode':'Period'}:</strong> {r.periode}</div>
              <div><strong>Mentor:</strong> {r.mentor}</div>
              <div><strong>Mentee:</strong> {r.mentee}</div>
              {r.tempatWaktu&&<div><strong>{lang==='id'?'Tempat - Waktu':'Place - Time'}:</strong> {r.tempatWaktu}</div>}
              {r.note&&<div style={{marginTop:6}}><strong>Note:</strong><br/>{r.note}</div>}
            </div>
          ):r.type==='ministry'?(
            <div style={{fontSize:13,color:th.textMid,lineHeight:2,marginTop:8}}>
              <div><strong>{lang==='id'?'Tempat':'Place'}:</strong> {r.minTempat}</div>
              <div><strong>COOL Leader:</strong> {r.coolLeader}</div>
              <div><strong>Worship Leader:</strong> {r.worshipLeader}</div>
              {r.sharingFirman&&<div><strong>{lang==='id'?'Sharing Firman':'Word Sharing'}:</strong> {r.sharingFirman}</div>}
              {r.topikSharing&&<div><strong>{lang==='id'?'Topik':'Topic'}:</strong> {r.topikSharing}</div>}
              {r.jumlahPersembahan&&<div><strong>{lang==='id'?'Persembahan':'Offering'}:</strong> ${r.jumlahPersembahan}</div>}
              {r.jumlahHadir&&<div><strong>{lang==='id'?'Hadir':'Attendance'}:</strong> {r.jumlahHadir}</div>}
              {(r.jamMulai||r.jamSelesai)&&<div><strong>{lang==='id'?'Waktu':'Time'}:</strong> {r.jamMulai} - {r.jamSelesai}</div>}
              {r.attendeeNames&&<div style={{marginTop:6}}><strong>{lang==='id'?'Nama yang Hadir':'Attendees'}:</strong><br/><div style={{whiteSpace:'pre-wrap'}}>{r.attendeeNames}</div></div>}
              {r.minNotes&&<div style={{marginTop:6}}><strong>Notes:</strong><br/>{r.minNotes}</div>}
            </div>
          ):(
            <div style={{fontSize:13,color:th.textMid,lineHeight:1.6,marginTop:8}}>{r.content}</div>
          )}
          {user.role==='admin'&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:8}}><div style={{fontSize:12,color:th.textLight}}>By: {r.userName}</div><button onClick={async()=>await deleteDoc(doc(db,'reports',r.id))} style={{backgroundColor:'#fff0f0',border:'none',borderRadius:10,padding:'4px 10px',color:th.danger,fontSize:11,fontWeight:700,cursor:'pointer'}}>🗑 Delete</button></div>}
        </Card>
      ))}
    </div></div>
  );
};


const SendNotificationScreen=({user,lang,allMembers})=>{
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [target,setTarget]=useState('all');
  const [selectedMembers,setSelectedMembers]=useState([]);
  const [sent,setSent]=useState(false);
  const [sending,setSending]=useState(false);
  const [members,setMembers]=useState([]);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'members'),snap=>{
      setMembers(snap.docs.map(d=>({id:d.id,...d.data()})).filter(m=>m.fcmToken));
    });
    return unsub;
  },[]);

  const handleSend=async()=>{
    if(!title||!body)return;
    setSending(true);
    try{
      const targets = target==='all' ? members : members.filter(m=>selectedMembers.includes(m.id));
      // Save notification to Firestore for in-app display
      await addDoc(collection(db,'notifications'),{
        type:'admin_message', title, body,
        sentBy:user.name, date:new Date().toLocaleDateString(),
        timestamp:new Date().toISOString(), readBy:[],
        targets:target==='all'?'all':selectedMembers
      });
      setSent(true); setTitle(''); setBody('');
      setTimeout(()=>setSent(false),3000);
    }catch(e){
      alert('Error: '+e.message);
    }
    setSending(false);
  };

  const toggleMember=id=>setSelectedMembers(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>📣 {lang==='id'?'Kirim Notifikasi':'Send Notification'}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{members.length} {lang==='id'?'member aktif':'active members'}</div>
      </div>
      {sent&&<div style={{backgroundColor:'#f0fff4',borderRadius:14,padding:12,marginBottom:14,display:'flex',gap:8,alignItems:'center'}}><span>✅</span><span style={{color:th.success,fontWeight:600}}>{lang==='id'?'Notifikasi terkirim!':'Notification sent!'}</span></div>}
      <Card>
        <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>{lang==='id'?'Kirim ke':'Send to'}</div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <button onClick={()=>setTarget('all')} style={{flex:1,padding:'10px',borderRadius:12,border:`2px solid ${target==='all'?th.primary:th.border}`,backgroundColor:target==='all'?`${th.primary}15`:'white',cursor:'pointer',fontWeight:600,fontSize:13,color:target==='all'?th.primary:th.textMid}}>
            👥 {lang==='id'?'Semua Member':'All Members'}
          </button>
          <button onClick={()=>setTarget('select')} style={{flex:1,padding:'10px',borderRadius:12,border:`2px solid ${target==='select'?th.primary:th.border}`,backgroundColor:target==='select'?`${th.primary}15`:'white',cursor:'pointer',fontWeight:600,fontSize:13,color:target==='select'?th.primary:th.textMid}}>
            👤 {lang==='id'?'Pilih Member':'Select Members'}
          </button>
        </div>
        {target==='select'&&<div style={{marginBottom:14,maxHeight:200,overflowY:'auto',border:`1px solid ${th.border}`,borderRadius:12,padding:8}}>
          {members.map(m=>(
            <div key={m.id} onClick={()=>toggleMember(m.id)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'8px',borderRadius:8,backgroundColor:selectedMembers.includes(m.id)?`${th.primary}10`:'white',cursor:'pointer',marginBottom:4}}>
              <div style={{width:20,height:20,borderRadius:10,border:`2px solid ${selectedMembers.includes(m.id)?th.primary:th.border}`,backgroundColor:selectedMembers.includes(m.id)?th.primary:'white',display:'flex',alignItems:'center',justifyContent:'center'}}>
                {selectedMembers.includes(m.id)&&<span style={{color:'white',fontSize:12}}>✓</span>}
              </div>
              <span style={{fontSize:13,fontWeight:selectedMembers.includes(m.id)?700:400}}>{m.name||m.email}</span>
            </div>
          ))}
          {members.length===0&&<div style={{textAlign:'center',padding:16,color:th.textMid,fontSize:13}}>{lang==='id'?'Belum ada member yang aktifkan notifikasi':'No members with notifications enabled'}</div>}
        </div>}
        <Inp label={lang==='id'?'Judul':'Title'} value={title} onChange={setTitle} placeholder={lang==='id'?'Judul notifikasi...':'Notification title...'}/>
        <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Pesan':'Message'}</label>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder={lang==='id'?'Tulis pesan...':'Write message...'} rows={4}
          style={{...S.inp,height:100,resize:'vertical',marginBottom:16}}/>
        <Btn label={sending?(lang==='id'?'Mengirim...':'Sending...'):`📣 ${lang==='id'?'Kirim Notifikasi':'Send Notification'}`} onClick={handleSend} disabled={!title||!body||sending}/>
      </Card>
    </div></div>
  );
};


const ClassesScreen=({user,lang,onNav})=>{
  const [selectedClass,setSelectedClass]=useState(null);
  const [note,setNote]=useState('');
  const [registrations,setRegistrations]=useState([]);
  const [success,setSucess]=useState(false);
  const [sending,setSending]=useState(false);

  const classes=[
    {key:'membership',label:'Membership',emoji:'🏛️',color:'#1a3a6b',bg:'#e8eef8',desc:lang==='id'?'Kelas untuk calon anggota gereja':'Class for prospective church members'},
    {key:'sob',label:'SOB - School of Believer',emoji:'📖',color:'#38a169',bg:'#e8f4e8',desc:lang==='id'?'Kelas dasar iman Kristen':'Foundation of Christian faith'},
    {key:'bbs',label:'BBS - Bethel Bible School',emoji:'✝️',color:'#805ad5',bg:'#f3e8ff',desc:lang==='id'?'Kelas Alkitab lanjutan':'Advanced Bible study'},
  ];

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'class_registrations'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      setRegistrations(user.role==='admin'?all:all.filter(r=>r.userId===user.uid));
    });
    return unsub;
  },[user.uid,user.role]);

  const alreadyRegistered=(key)=>registrations.some(r=>r.classKey===key&&r.userId===user.uid);

  const handleRegister=async()=>{
    if(!selectedClass)return;
    setSending(true);
    const cls=classes.find(c=>c.key===selectedClass);
    await addDoc(collection(db,'class_registrations'),{
      userId:user.uid, userName:user.name, userEmail:user.email,
      userPhone:user.phone||'-', classKey:selectedClass,
      className:cls.label, note,
      status:'registered', date:new Date().toLocaleDateString(),
      timestamp:new Date().toISOString()
    });
    // Notify admin
    await addDoc(collection(db,'notifications'),{
      type:'new_class_registration', userName:user.name,
      userEmail:user.email, className:cls.label,
      date:new Date().toLocaleDateString(),
      timestamp:new Date().toISOString(), readBy:[]
    });
    setNote(''); setSelectedClass(null); setSucess(true);
    setTimeout(()=>setSucess(false),6000);
    setSending(false);
  };

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10,cursor:'pointer'}} onClick={()=>onNav&&onNav('home')}>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:15}}>←</span>
          <span style={{color:'rgba(255,255,255,0.7)',fontSize:13,fontWeight:600}}>{lang==='id'?'Kembali':'Back'}</span>
        </div>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>{lang==='id'?'Kelas Pengajaran':'Teaching Classes'}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{lang==='id'?'Daftar kelas yang tersedia':'Available classes'}</div>
      </div>

      {success&&<div style={{backgroundColor:'#f0fff4',borderRadius:14,padding:16,marginBottom:14}}>
        <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
          <span>✅</span><span style={{color:th.success,fontWeight:700,fontSize:15}}>{lang==='id'?'Pendaftaran berhasil!':'Registration successful!'}</span>
        </div>
        <div style={{fontSize:13,color:th.text,lineHeight:1.6}}>
          {lang==='id'
            ?'Terima kasih sudah mendaftar! Kami akan menghubungi Anda lebih lanjut mengenai jadwal dan detail kelas. Tuhan Yesus memberkati 🙏'
            :"Thank you for registering! We will contact you further regarding the class schedule and details. God bless you 🙏"}
        </div>
      </div>}

      {/* Class Cards */}
      {classes.map(cls=>{
        const registered=alreadyRegistered(cls.key);
        const isSelected=selectedClass===cls.key;
        return(
          <div key={cls.key} style={{backgroundColor:cls.bg,borderRadius:22,padding:20,marginBottom:14,border:`2px solid ${isSelected?cls.color:registered?cls.color+'50':'transparent'}`,boxShadow:`0 4px 10px ${cls.color}20`,cursor:registered?'default':'pointer'}}
            onClick={()=>!registered&&setSelectedClass(isSelected?null:cls.key)}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:56,height:56,borderRadius:28,backgroundColor:`${cls.color}20`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{cls.emoji}</div>
                <div>
                  <div style={{fontSize:16,fontWeight:800,color:cls.color}}>{cls.label}</div>
                  <div style={{fontSize:12,color:`${cls.color}99`,marginTop:2}}>{cls.desc}</div>
                </div>
              </div>
              {registered
                ?<span style={{backgroundColor:`${th.success}20`,borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:700,color:th.success}}>✓ {lang==='id'?'Terdaftar':'Registered'}</span>
                :<span style={{fontSize:22,color:cls.color}}>{isSelected?'▲':'›'}</span>
              }
            </div>
            {isSelected&&!registered&&(
              <div style={{marginTop:14,paddingTop:14,borderTop:`1px solid ${cls.color}20`}}>
                <label style={{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'}}>{lang==='id'?'Catatan (opsional)':'Note (optional)'}</label>
                <textarea value={note} onChange={e=>setNote(e.target.value)}
                  placeholder={lang==='id'?'Tulis pertanyaan atau keterangan...':'Write any questions or notes...'}
                  rows={3} style={{...S.inp,height:80,resize:'none',marginBottom:12}}/>
                <button onClick={e=>{e.stopPropagation();handleRegister();}} disabled={sending}
                  style={{width:'100%',backgroundColor:cls.color,color:'white',border:'none',borderRadius:14,padding:'12px',fontSize:14,fontWeight:700,cursor:'pointer',opacity:sending?0.6:1}}>
                  {sending?(lang==='id'?'Mendaftar...':'Registering...'):`${cls.emoji} ${lang==='id'?'Daftar Sekarang':'Register Now'}`}
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Admin - list of registrations */}
      {user.role==='admin'&&registrations.length>0&&(
        <div style={{marginTop:8}}>
          <div style={{fontSize:14,fontWeight:700,color:th.text,marginBottom:12}}>
            📋 {lang==='id'?'Daftar Pendaftaran':'Registration List'} ({registrations.length})
          </div>
          {[...registrations].reverse().map(r=>(
            <div key={r.id} style={{backgroundColor:'white',borderRadius:16,padding:14,marginBottom:10,boxShadow:'0 2px 6px rgba(0,0,0,0.05)'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
                <span style={{fontSize:14,fontWeight:700}}>👤 {r.userName}</span>
                <span style={{fontSize:11,color:th.textLight}}>{r.date}</span>
              </div>
              <div style={{fontSize:12,color:th.textMid,lineHeight:1.8}}>
                📧 {r.userEmail}<br/>
                📞 {r.userPhone}<br/>
                📚 {r.className}
                {r.note&&<><br/>📝 {r.note}</>}
              </div>
              <button onClick={async()=>await deleteDoc(doc(db,'class_registrations',r.id))} style={{marginTop:8,backgroundColor:'#fff0f0',border:'none',borderRadius:10,padding:'4px 12px',color:th.danger,fontSize:11,fontWeight:700,cursor:'pointer'}}>🗑 Delete</button>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
};


const ScanAttendanceScreen=({user,lang,lp={}})=>{
  const [eventName,setEventName]=useState('');
  const [scanning,setScanning]=useState(false);
  const [scannedList,setScannedList]=useState([]);
  const [lastScan,setLastScan]=useState(null);
  const [events,setEvents]=useState([]);
  const [selectedEvent,setSelectedEvent]=useState(null);
  const scannerRef=useRef(null);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'attendance_events'),snap=>{
      setEvents(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(selectedEvent){
      const unsub=onSnapshot(collection(db,'attendance'),snap=>{
        setScannedList(snap.docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.eventId===selectedEvent.id));
      });
      return unsub;
    }
  },[selectedEvent]);

  const createEvent=async()=>{
    if(!eventName)return;
    const ref=await addDoc(collection(db,'attendance_events'),{name:eventName,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString(),createdBy:user.name});
    setSelectedEvent({id:ref.id,name:eventName});
    setEventName('');
  };

  const startScanning=()=>{
    setScanning(true);
    setTimeout(()=>{
      const scanner=new Html5QrcodeScanner('qr-reader',{fps:10,qrbox:250,rememberLastUsedCamera:true,videoConstraints:{facingMode:'environment'}},false);
      scanner.render(onScanSuccess, ()=>{});
      scannerRef.current=scanner;
    },100);
  };

  const stopScanning=()=>{
    if(scannerRef.current){
      scannerRef.current.clear().catch(()=>{});
      scannerRef.current=null;
    }
    setScanning(false);
  };

  const isProcessingRef=useRef(false);
  const scannedUidsRef=useRef(new Set());

  useEffect(()=>{
    scannedUidsRef.current=new Set(scannedList.map(s=>s.userId));
  },[scannedList]);
  const onScanSuccess=async(decodedText)=>{
    if(isProcessingRef.current)return;
    isProcessingRef.current=true;
    try{
      const data=JSON.parse(decodedText);
      if(!data.uid||!data.name){
        setLastScan({error:true,msg:lang==='id'?'QR tidak valid':'Invalid QR'});
        setTimeout(()=>{isProcessingRef.current=false;},1500);
        return;
      }
      // Check if already scanned for this event
      const already=scannedUidsRef.current.has(data.uid);
      if(already){
        setLastScan({error:true,msg:lang==='id'?`${data.name} sudah discan`:`${data.name} already scanned`});
        setTimeout(()=>{setLastScan(null);isProcessingRef.current=false;},1500);
        return;
      }
      scannedUidsRef.current.add(data.uid);
      await addDoc(collection(db,'attendance'),{
        eventId:selectedEvent.id, eventName:selectedEvent.name,
        userId:data.uid, userName:data.name, userEmail:data.email||'', userRole:data.role||'member',
        date:new Date().toLocaleDateString(), timestamp:new Date().toISOString()
      });
      setLastScan({error:false,msg:data.name});
      setTimeout(()=>{setLastScan(null);isProcessingRef.current=false;},1500);
    }catch(e){
      setLastScan({error:true,msg:lang==='id'?'QR tidak valid':'Invalid QR'});
      setTimeout(()=>{isProcessingRef.current=false;},1500);
    }
  };

  const exportAttendance=()=>{
    const headers=['Name','Email','Role','Time'];
    const rows=scannedList.map(s=>[s.userName,s.userEmail,s.userRole,new Date(s.timestamp).toLocaleTimeString()]);
    const csv=[headers,...rows].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='Attendance_'+selectedEvent.name.replace(/\s+/g,'_')+'_'+new Date().toLocaleDateString('en-CA')+'.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if(user.role!=='admin'&&user.role!=='usher'){
    return(
      <div style={S.screen}><div style={{padding:16}}>
        <div style={{textAlign:'center',padding:48}}>
          <div style={{fontSize:48,marginBottom:16}}>🔒</div>
          <div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Khusus Admin':'Admin Only'}</div>
        </div>
      </div></div>
    );
  }

  if(!selectedEvent){
    return(
      <div style={S.screen}><div style={{padding:16}}>
        <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
          <div style={{color:'white',fontSize:20,fontWeight:700}}>📷 {lang==='id'?'Scan Kehadiran':'Scan Attendance'}</div>
          <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{lang==='id'?'Buat atau pilih event':'Create or select event'}</div>
        </div>
        <Card>
          <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>{lang==='id'?'Buat Event Baru':'Create New Event'}</div>
          <Inp label={lang==='id'?'Nama Event':'Event Name'} value={eventName} onChange={setEventName} placeholder="e.g. Youth Camp 2026"/>
          <Btn label={lang==='id'?'Buat & Mulai Scan':'Create & Start Scanning'} onClick={createEvent} disabled={!eventName}/>
        </Card>
        {events.length>0&&(
          <div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:12}}>{lang==='id'?'Event Sebelumnya':'Previous Events'}</div>
            {[...events].reverse().map(ev=>(
              <Card key={ev.id}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div onClick={()=>setSelectedEvent(ev)} style={{flex:1,cursor:'pointer'}}>
                    <div style={{fontSize:14,fontWeight:700}}>{ev.name}</div>
                    <div style={{fontSize:11,color:th.textLight}}>{ev.date}</div>
                  </div>
                  {user.role==='admin'&&<button onClick={async()=>{await deleteDoc(doc(db,'attendance_events',ev.id));}} style={{backgroundColor:'#fff0f0',border:'none',borderRadius:10,padding:'6px 10px',color:th.danger,fontSize:11,fontWeight:700,cursor:'pointer',marginRight:8}}>🗑</button>}
                  <span onClick={()=>setSelectedEvent(ev)} style={{fontSize:20,color:th.primary,cursor:'pointer'}}>›</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div></div>
    );
  }

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div onClick={()=>{stopScanning();setSelectedEvent(null);}} style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer',color:th.primary,fontWeight:700}}>← {lang==='id'?'Kembali':'Back'}</div>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:18,fontWeight:700}}>{selectedEvent.name}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{scannedList.length} {lang==='id'?'orang hadir':'people checked in'}</div>
      </div>

      {lastScan&&(
        <div style={{backgroundColor:lastScan.error?'#fff0f0':'#f0fff4',borderRadius:14,padding:12,marginBottom:14,display:'flex',gap:8,alignItems:'center'}}>
          <span>{lastScan.error?'❌':'✅'}</span>
          <span style={{color:lastScan.error?th.danger:th.success,fontWeight:600}}>{lastScan.error?lastScan.msg:`${lastScan.msg} - ${lang==='id'?'Berhasil!':'Checked in!'}`}</span>
        </div>
      )}

      {!scanning?(
        <Btn label={`📷 ${lang==='id'?'Mulai Scan':'Start Scanning'}`} onClick={startScanning}/>
      ):(
        <>
          <div id="qr-reader" style={{marginBottom:16,borderRadius:16,overflow:'hidden'}}></div>
          <Btn label={lang==='id'?'Berhenti Scan':'Stop Scanning'} onClick={stopScanning} variant="danger"/>
        </>
      )}

      {scannedList.length>0&&(
        <button onClick={exportAttendance}
          style={{width:'100%',backgroundColor:`${th.success}10`,border:`2px solid ${th.success}`,borderRadius:14,padding:'12px',cursor:'pointer',fontSize:14,fontWeight:700,color:th.success,marginTop:16,marginBottom:16}}>
          📊 {lang==='id'?'Export Daftar Hadir':'Export Attendance List'}
        </button>
      )}

      <div style={{fontSize:14,fontWeight:700,marginBottom:12,marginTop:16}}>{lang==='id'?'Daftar Hadir':'Attendance List'}</div>
      {scannedList.length===0?(
        <div style={{textAlign:'center',padding:32,color:th.textMid}}>{lang==='id'?'Belum ada yang scan':'No one scanned yet'}</div>
      ):[...scannedList].reverse().map(s=>(
        <div key={s.id} style={{backgroundColor:'white',borderRadius:14,padding:12,marginBottom:8,display:'flex',alignItems:'center',gap:10,boxShadow:'0 2px 6px rgba(0,0,0,0.05)'}}>
          <div style={{width:36,height:36,borderRadius:18,backgroundColor:th.accent,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <span style={{fontSize:14,fontWeight:700,color:th.primary}}>{(s.userName||'?')[0].toUpperCase()}</span>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600}}>{s.userName}</div>
            <div style={{fontSize:11,color:th.textLight}}>{new Date(s.timestamp).toLocaleTimeString()}</div>
          </div>
          <span style={{color:th.success,fontSize:18}}>✓</span>
        </div>
      ))}
    </div></div>
  );
};


const RoleManagementScreen=({user,lang,lp,setLeaderPermissions})=>{
  const [members,setMembers]=useState([]);
  const [search,setSearch]=useState('');
  const [roleFilter,setRoleFilter]=useState(null);

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'members'),snap=>{
      setMembers(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);

  const handleRoleChange=async(memberId,newRole)=>{
    await updateDoc(doc(db,'members',memberId),{role:newRole});
  };

  const handlePermToggle=async(key)=>{
    const newPerm={...lp,[key]:!lp[key]};
    setLeaderPermissions(newPerm);
    await setDoc(doc(db,'settings','leader_permissions'),newPerm);
  };

  const filtered=members.filter(m=>{
    const matchSearch=(m.name||'').toLowerCase().includes(search.toLowerCase())||(m.email||'').toLowerCase().includes(search.toLowerCase());
    const matchRole=!roleFilter||(m.role||'member')===roleFilter;
    return matchSearch&&matchRole;
  });

  const roleColors={admin:th.danger,usher:'#dd6b20',leader:'#7c3aed',member:th.textMid};
  const roleLabels={admin:'Admin',usher:'Usher',leader:'Leader',member:lang==='id'?'Member':'Member'};

  const permLabels={
    bulletin:lang==='id'?'Post/Edit Bulletin':'Post/Edit Bulletin',
    schedule:lang==='id'?'Post/Edit Jadwal':'Post/Edit Schedule',
    scanAttendance:lang==='id'?'Scan Absensi':'Scan Attendance',
    checkInReport:lang==='id'?'Lihat Laporan Check In':'View Check In Report',
    approveRequest:lang==='id'?'Approve/Reject Request':'Approve/Reject Request',
    exportCsv:lang==='id'?'Export CSV':'Export CSV',
  };

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>👥 {lang==='id'?'Kelola Role':'Role Management'}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{members.length} {lang==='id'?'member terdaftar':'registered members'}</div>
        <div style={{display:'flex',gap:10,marginTop:10,flexWrap:'wrap'}}>
          {[
            {key:'member',label:lang==='id'?'Member':'Member'},
            {key:'leader',label:'Leader'},
            {key:'usher',label:'Usher'},
            {key:'admin',label:'Admin'},
          ].map(r=>(
            <div key={r.key} onClick={()=>setRoleFilter(roleFilter===r.key?null:r.key)} style={{backgroundColor:roleFilter===r.key?'white':'rgba(255,255,255,0.15)',borderRadius:12,padding:'6px 12px',cursor:'pointer',border:roleFilter===r.key?`1.5px solid white`:'1.5px solid transparent'}}>
              <span style={{color:roleFilter===r.key?th.primary:'white',fontSize:12,fontWeight:700}}>{members.filter(m=>(m.role||'member')===r.key).length}</span>
              <span style={{color:roleFilter===r.key?th.primary:'rgba(255,255,255,0.7)',fontSize:11,marginLeft:4}}>{r.label}</span>
            </div>
          ))}
          {roleFilter&&<div onClick={()=>setRoleFilter(null)} style={{backgroundColor:'rgba(255,255,255,0.15)',borderRadius:12,padding:'6px 12px',cursor:'pointer'}}>
            <span style={{color:'white',fontSize:11}}>✕ {lang==='id'?'Reset':'Clear'}</span>
          </div>}
        </div>
      </div>
      <Card>
        <div style={{fontSize:14,fontWeight:700,color:'#7c3aed',marginBottom:12}}>🔑 {lang==='id'?'Permission Leader':'Leader Permissions'}</div>
        {Object.entries(permLabels).map(([key,label])=>(
          <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingVertical:8,marginBottom:10}}>
            <span style={{fontSize:13,color:th.text}}>{label}</span>
            <div onClick={()=>handlePermToggle(key)} style={{width:44,height:24,borderRadius:12,backgroundColor:lp[key]?'#7c3aed':th.border,cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
              <div style={{position:'absolute',top:2,left:lp[key]?22:2,width:20,height:20,borderRadius:10,backgroundColor:'white',transition:'left 0.2s'}}/>
            </div>
          </div>
        ))}
      </Card>
      <Inp value={search} onChange={setSearch} placeholder={lang==='id'?'Cari nama atau email...':'Search name or email...'}/>
      {[...filtered].sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map((m,idx)=>(
        <Card key={m.id}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:22,backgroundColor:`${roleColors[m.role]||th.textMid}20`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <span style={{fontSize:16,fontWeight:800,color:roleColors[m.role]||th.textMid}}>{(m.name||'?')[0].toUpperCase()}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:2}}>
                <div style={{fontSize:14,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.name}</div>
                <span style={{backgroundColor:`${roleColors[m.role]||th.textMid}20`,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700,color:roleColors[m.role]||th.textMid,flexShrink:0}}>{roleLabels[m.role]||m.role}</span>
              </div>
              <div style={{fontSize:11,color:th.textLight,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.email}</div>
              <div style={{display:'flex',gap:10,marginTop:2}}>
                {m.joinDate&&<span style={{fontSize:10,color:th.textMid}}>📅 {m.joinDate}</span>}
                {m.lastSeen&&<span style={{fontSize:10,color:th.textMid}}>👁 {(()=>{
                  const diff=Math.floor((new Date()-new Date(m.lastSeen))/60000);
                  if(diff<1) return lang==='id'?'Baru saja':'Just now';
                  if(diff<60) return `${diff}m ${lang==='id'?'lalu':'ago'}`;
                  if(diff<1440) return `${Math.floor(diff/60)}h ${lang==='id'?'lalu':'ago'}`;
                  return `${Math.floor(diff/1440)}d ${lang==='id'?'lalu':'ago'}`;
                })()}</span>}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {['member','leader','usher','admin'].map(r=>(
              <button key={r} onClick={()=>handleRoleChange(m.id,r)}
                disabled={m.role===r}
                style={{flex:1,padding:'7px 4px',borderRadius:10,border:`1.5px solid ${m.role===r?roleColors[r]:th.border}`,backgroundColor:m.role===r?`${roleColors[r]}15`:'white',color:m.role===r?roleColors[r]:th.textMid,fontSize:10,fontWeight:700,cursor:m.role===r?'default':'pointer',opacity:m.role===r?1:0.7}}>
                {roleLabels[r]}
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div></div>
  );
};

export default function App(){
  const [lang,setLang]=useState(localStorage.getItem('churchLang')||'en');
  const [user,setUser]=useState(null);
  const [screen,setScreen]=useState('login');
  const [regSuccess,setRegSuccess]=useState(false);
  const [activeTab,setActiveTab]=useState('home');
  const [scheduleKey,setScheduleKey]=useState(0);
  const [directBulletinPost,setDirectBulletinPost]=useState(null);
  const [showNotif,setShowNotif]=useState(false);
  const [clearedNotifs,setClearedNotifs]=useState([]);
  const [notifications,setNotifications]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [leaderPermissions,setLeaderPermissions]=useState({bulletin:false,schedule:false,scanAttendance:false,checkInReport:false,approveRequest:false,exportCsv:false});

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async fireUser=>{
      if(fireUser){
        const snap=await getDoc(doc(db,'members',fireUser.uid));
        const userData={uid:fireUser.uid,email:fireUser.email,...(snap.exists()?snap.data():{})};
        setUser(userData);
        await setDoc(doc(db,'members',fireUser.uid),{lastSeen:new Date().toISOString()},{merge:true});
      }else setUser(null);
      setLoaded(true);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(doc(db,'settings','leader_permissions'),snap=>{
      if(snap.exists()) setLeaderPermissions(snap.data());
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(!user)return;
    const unsub=onSnapshot(collection(db,'notifications'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      const filtered=all.filter(n=>{
        // Backward-compat: notif lama pakai field 'read' global (admin-only types)
        if(n.readBy===undefined && n.read) return false;
        // Notif baru: per-user readBy array
        if(n.readBy && n.readBy.includes(user.uid)) return false;
        if(user.role==='admin') return true;
        if(n.type==='admin_message'){
          if(n.targets==='all') return true;
          if(Array.isArray(n.targets)&&n.targets.includes(user.uid)) return true;
        }
        if(n.type==='new_bulletin') return true;
        return false;
      });
      setNotifications(filtered);
      if('setAppBadge' in navigator){
        if(filtered.length>0){
          navigator.setAppBadge(filtered.length).catch(()=>{});
        }else{
          navigator.clearAppBadge().catch(()=>{});
        }
      }
    });
    return unsub;
  },[user]);

  useEffect(()=>{localStorage.setItem('churchLang',lang);},[lang]);

  const unreadCount=notifications.filter(n=>!clearedNotifs.includes(n.id)).length;

  if(!loaded) return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',backgroundColor:th.primary}}>
      <img src={LOGO_URL} style={{width:80,height:80,borderRadius:40,marginBottom:20,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
      <div style={{color:'white',fontSize:16}}>Loading...</div>
    </div>
  );

  if(!user) return(
    <div style={S.app}>
      {screen==='register'
        ?<RegisterScreen lang={lang} setLang={setLang} onBack={()=>setScreen('login')} onRegistered={()=>{setScreen('login');setRegSuccess(true);setTimeout(()=>setRegSuccess(false),5000);}}/>
        :<LoginScreen lang={lang} setLang={setLang} onRegister={()=>{setScreen('register');setRegSuccess(false);}} regSuccess={regSuccess}/>
      }
    </div>
  );

  const renderScreen=()=>{
    switch(activeTab){
      case 'home':      return <HomeScreen user={user} onNav={(tab,data)=>{ if(tab==='bulletin'&&data){ setDirectBulletinPost(data); } setActiveTab(tab); }} lang={lang} lp={leaderPermissions}/>;
      case 'checkin':   return <CheckInScreen user={user} lang={lang} lp={leaderPermissions}/>;
      case 'give':      return <GiveScreen user={user} lang={lang}/>;
      case 'schedule':  return <ScheduleScreen key={scheduleKey} user={user} lang={lang} lp={leaderPermissions}/>;
      case 'bulletin':  return <BulletinScreen user={user} lang={lang} directPost={directBulletinPost} clearDirectPost={()=>setDirectBulletinPost(null)} lp={leaderPermissions}/>;
      case 'request':   return <RequestScreen user={user} lang={lang} lp={leaderPermissions} onNav={(tab)=>setActiveTab(tab)}/>;
      case 'volunteer': return <VolunteerScreen user={user} lang={lang} onNav={(tab)=>setActiveTab(tab)}/>;
      case 'scan':      return <ScanAttendanceScreen user={user} lang={lang} lp={leaderPermissions}/>;
      case 'roles':     return <RoleManagementScreen user={user} lang={lang} lp={leaderPermissions} setLeaderPermissions={setLeaderPermissions}/>;
      case 'classes':   return <ClassesScreen user={user} lang={lang} onNav={(tab)=>setActiveTab(tab)}/>;
      case 'notify':    return <SendNotificationScreen user={user} lang={lang}/>;
      case 'report':    return <ReportScreen user={user} lang={lang} lp={leaderPermissions} onNav={(tab)=>setActiveTab(tab)}/>;
      case 'profile':   return <ProfileScreen user={user} setUser={setUser} lang={lang}/>;
      default: return null;
    }
  };

  return(
    <div style={S.app}>
      <Header lang={lang} setLang={setLang} onBell={()=>setShowNotif(true)} unreadCount={unreadCount} onLogout={()=>signOut(auth)}/>
      <div style={{flex:1}}>{renderScreen()}</div>
      <BottomNav active={activeTab} onNav={(tab)=>{ setActiveTab(tab); if(tab==='schedule') setScheduleKey(k=>k+1); if(tab==='bulletin') setDirectBulletinPost(null); if(user) setDoc(doc(db,'members',user.uid),{lastSeen:new Date().toISOString()},{merge:true}); }} lang={lang}/>
      {showNotif&&<div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,height:'100vh',backgroundColor:th.bg,zIndex:1000,display:'flex',flexDirection:'column'}}>
        <div style={{backgroundColor:th.primary,padding:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{color:'white',fontSize:18,fontWeight:700}}>🔔 {lang==='id'?'Notifikasi':'Notifications'}</span>
          <div style={{display:'flex',gap:10}}>
            <button onClick={async()=>{ setClearedNotifs(notifications.map(n=>n.id)); await Promise.all(notifications.map(n=>updateDoc(doc(db,'notifications',n.id),{readBy:arrayUnion(user.uid)}))); }} style={{backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 12px',color:'white',fontSize:12,cursor:'pointer'}}>{lang==='id'?'Hapus Semua':'Clear All'}</button>
            <button onClick={()=>setShowNotif(false)} style={{backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 12px',color:'white',fontSize:12,cursor:'pointer'}}>{lang==='id'?'Tutup':'Close'}</button>
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:16}}>
          {notifications.filter(n=>!clearedNotifs.includes(n.id)).length===0
            ?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:40,marginBottom:12}}>🔔</div><div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Tidak ada notifikasi':'No notifications'}</div></div>
            :notifications.filter(n=>!clearedNotifs.includes(n.id)).map(n=>{
              const icon=n.type==='new_member'?'🎉':n.type==='new_request'?'📝':n.type==='admin_message'?'📣':n.type==='new_class_registration'?'📚':n.type==='new_report'?'📄':n.type==='new_bulletin'?'📰':'🙋';
              const color=n.type==='new_member'?th.success:n.type==='new_request'?th.primary:n.type==='admin_message'?th.primary:n.type==='new_class_registration'?'#805ad5':n.type==='new_report'?'#2c7a7b':n.type==='new_bulletin'?'#1a3a6b':'#dd6b20';
              const title=n.type==='new_member'?(lang==='id'?'Member Baru':'New Member'):n.type==='new_request'?(lang==='id'?'Permohonan Baru':'New Request'):n.type==='admin_message'?(n.title||'Pesan dari Admin'):n.type==='new_class_registration'?(lang==='id'?'Pendaftaran Kelas':'Class Registration'):n.type==='new_report'?(lang==='id'?'Laporan Baru':'New Report'):n.type==='new_bulletin'?(lang==='id'?'Postingan Baru':'New Post'):(lang==='id'?'Volunteer Baru':'New Volunteer');
              return(
                <div key={n.id} onClick={n.type==='new_bulletin'?()=>{
                  setShowNotif(false);
                  setActiveTab('bulletin');
                  setDirectBulletinPost({cat:n.cat||'announcement',subType:n.subType||null,_categoryOnly:true});
                  setClearedNotifs(prev=>[...prev,n.id]);
                  updateDoc(doc(db,'notifications',n.id),{readBy:arrayUnion(user.uid)});
                }:undefined} style={{backgroundColor:'white',borderRadius:18,padding:16,marginBottom:10,boxShadow:'0 2px 6px rgba(0,0,0,0.05)',borderLeft:`4px solid ${color}`,cursor:n.type==='new_bulletin'?'pointer':'default'}}>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <span style={{fontSize:32}}>{icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color,fontSize:14,marginBottom:4}}>{title}</div>
                      {n.type!=='new_bulletin'&&<div style={{fontSize:13,fontWeight:600}}>{n.userName}</div>}
                      {n.type==='admin_message'?<div style={{fontSize:13,color:th.text,marginTop:4}}>{n.body}</div>:n.type==='new_bulletin'?<div style={{fontSize:12,color:th.textMid,marginTop:2}}>{n.category&&<span style={{fontWeight:600}}>{n.category}</span>}{n.title?' · '+n.title:''} · {n.date}</div>:<div style={{fontSize:12,color:th.textMid,marginTop:2}}>{n.userEmail||''} · {n.date}</div>}
                    </div>
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>}
    </div>
  );
}

const ProfileScreen=({user,setUser,lang})=>{
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(user.name||'');
  const [email,setEmail]=useState(user.email||'');
  const [phone,setPhone]=useState(user.phone||'');
  const [address,setAddress]=useState(user.address||'');
  const [baptismDate,setBaptismDate]=useState(user.baptismDate||'');
  const [firstChurchDate,setFirstChurchDate]=useState(user.firstChurchDate||'');
  const [birthDate,setBirthDate]=useState(user.birthDate||'');
  const [avatarColor,setAvatarColor]=useState(user.avatarColor||th.accent);
  const [showColorPicker,setShowColorPicker]=useState(false);
  const [saved,setSaved]=useState(false);
  const [showQR,setShowQR]=useState(false);

  const handleSave=async()=>{
    await setDoc(doc(db,'members',user.uid),{name,email,phone,address,baptismDate,firstChurchDate,birthDate,avatarColor,role:user.role,joinDate:user.joinDate,updatedAt:new Date().toISOString()},{merge:true});
    setUser({...user,name,email,phone,address,baptismDate,firstChurchDate,birthDate,avatarColor});
    setSaved(true);setEditing(false);setTimeout(()=>setSaved(false),2500);
  };

  const initials=(user.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const colors=['#c8a84b','#ffffff','#e53e3e','#38a169','#805ad5','#dd6b20','#d53f8c','#2b6cb0'];

  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:24,margin:16,marginBottom:0,padding:'30px 24px 40px',textAlign:'center',boxShadow:'0 6px 16px rgba(26,58,107,0.4)'}}>
        <div onClick={()=>setShowColorPicker(!showColorPicker)}
          style={{width:90,height:90,borderRadius:45,backgroundColor:avatarColor,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 8px',border:'3px solid rgba(255,255,255,0.3)',cursor:'pointer'}}>
          <span style={{fontSize:32,fontWeight:800,color:avatarColor==='#ffffff'?th.primary:'white'}}>{initials}</span>
        </div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginBottom:8}}>🎨 {lang==='id'?'Tap untuk ganti warna':'Tap to change color'}</div>
        {showColorPicker&&<div style={{display:'flex',gap:8,justifyContent:'center',marginBottom:10,flexWrap:'wrap'}}>
          {colors.map(col=>(
            <div key={col} onClick={async()=>{setAvatarColor(col);setShowColorPicker(false);await setDoc(doc(db,'members',user.uid),{avatarColor:col},{merge:true});setUser({...user,avatarColor:col});}}
              style={{width:32,height:32,borderRadius:16,backgroundColor:col,cursor:'pointer',border:avatarColor===col?'3px solid white':'1.5px solid rgba(255,255,255,0.4)'}}/>
          ))}
        </div>}
        <span style={{backgroundColor:'rgba(200,168,75,0.25)',borderRadius:20,padding:'5px 14px',color:th.accentLight,fontSize:12,fontWeight:700,letterSpacing:1,marginBottom:10,display:'inline-block'}}>{(user.role||'MEMBER').toUpperCase()}</span>
        <div style={{color:'white',fontSize:20,fontWeight:700,marginBottom:4}}>{user.name}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginBottom:14}}>{user.email}</div>
        <button onClick={()=>setShowQR(true)}
          style={{marginTop:14,backgroundColor:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.3)',borderRadius:20,padding:'8px 18px',color:'white',fontSize:13,fontWeight:600,cursor:'pointer'}}>
          🔲 QR Code
        </button>
      </div>

      {showQR&&(
        <div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,height:'100vh',backgroundColor:'rgba(0,0,0,0.85)',zIndex:1000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <div style={{backgroundColor:'white',borderRadius:24,padding:32,textAlign:'center',margin:24}}>
            <span style={{backgroundColor:`${th.primary}15`,borderRadius:20,padding:'5px 14px',color:th.primary,fontSize:12,fontWeight:700,letterSpacing:1,marginBottom:12,display:'inline-block'}}>{(user.role||'MEMBER').toUpperCase()}</span>
            <div style={{fontSize:18,fontWeight:700,color:th.primary,marginBottom:4}}>{user.name}</div>
            <div style={{fontSize:13,color:th.textMid,marginBottom:20}}>{user.email}</div>
            <div style={{display:'flex',justifyContent:'center',marginBottom:20}}>
              <QRCode
                value={JSON.stringify({uid:user.uid,name:user.name,email:user.email,role:user.role,church:'Bethel International Church NY'})}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <div style={{fontSize:11,color:th.textLight,marginBottom:20}}>{lang==='id'?'Tunjukkan QR code ini ke admin':'Show this QR code to admin'}</div>
            <button onClick={()=>setShowQR(false)}
              style={{backgroundColor:th.primary,color:'white',border:'none',borderRadius:14,padding:'12px 32px',fontSize:15,fontWeight:700,cursor:'pointer'}}>
              {lang==='id'?'Tutup':'Close'}
            </button>
          </div>
        </div>
      )}
      <div style={{padding:16}}>
        {saved&&<div style={{backgroundColor:'#f0fff4',borderRadius:14,padding:12,marginBottom:14,display:'flex',gap:8,alignItems:'center'}}><span>✅</span><span style={{color:th.success,fontWeight:600}}>{lang==='id'?'Profil berhasil disimpan!':'Profile saved!'}</span></div>}
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontSize:16,fontWeight:700}}>{lang==='id'?'Informasi Pribadi':'Personal Information'}</span>
            <button onClick={()=>setEditing(!editing)} style={{backgroundColor:editing?'#fff5f5':`${th.primary}10`,border:`1px solid ${editing?th.danger:th.primary}`,borderRadius:20,padding:'6px 14px',fontSize:13,fontWeight:600,color:editing?th.danger:th.primary,cursor:'pointer'}}>
              {editing?(lang==='id'?'Batal':'Cancel'):(lang==='id'?'Edit':'Edit')}
            </button>
          </div>
          {[
            {label:lang==='id'?'Nama Lengkap':'Full Name',value:name,set:setName},
            {label:'Email',value:email,set:setEmail},
            {label:lang==='id'?'No. HP':'Phone',value:phone,set:setPhone},
            {label:lang==='id'?'Alamat':'Address',value:address,set:setAddress},
          ].map((item,i)=>(
            <div key={i} style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:th.textLight,marginBottom:5,textTransform:'uppercase'}}>{item.label}</div>
              {editing?<input value={item.value} onChange={e=>item.set(e.target.value)} style={{...S.inp,backgroundColor:th.bg}}/>
              :<div style={{fontSize:15,color:th.text,fontWeight:500}}>{item.value||'-'}</div>}
            </div>
          ))}
          {editing&&<>
            {[
              {label:lang==='id'?'Tanggal Lahir':'Birth Date',value:birthDate,set:setBirthDate},
              {label:lang==='id'?'Tanggal Baptis':'Baptism Date',value:baptismDate,set:setBaptismDate},
              {label:lang==='id'?'Pertama Bergereja':'First Church Date',value:firstChurchDate,set:setFirstChurchDate},
            ].map((item,i)=>(
              <div key={i} style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:700,color:th.textLight,marginBottom:5,textTransform:'uppercase'}}>{item.label}</div>
                <input type="date" value={item.value} onChange={e=>item.set(e.target.value)} style={{...S.inp,backgroundColor:th.bg,WebkitAppearance:"none",appearance:"none",width:"100%",boxSizing:"border-box"}}/>
              </div>
            ))}
            <Btn label={lang==='id'?'Simpan Perubahan':'Save Changes'} onClick={handleSave} style={{marginTop:6}}/>
          </>}
        </Card>
        <Card>
          <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>{lang==='id'?'Info Keanggotaan':'Membership Info'}</div>
          {[
            {label:lang==='id'?'Tanggal Bergabung':'Join Date',value:user.joinDate||'-'},
            {label:lang==='id'?'Tanggal Lahir':'Birth Date',value:birthDate||'-'},
            {label:lang==='id'?'Tanggal Baptis':'Baptism Date',value:baptismDate||'-'},
            {label:lang==='id'?'Pertama Bergereja':'First Church Date',value:firstChurchDate||'-'},
            {label:'Status',value:lang==='id'?'Jemaat Aktif':'Active Member'},
          ].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<arr.length-1?`1px solid ${th.border}`:'none'}}>
              <span style={{fontSize:13,color:th.textMid}}>{item.label}</span>
              <span style={{fontSize:13,fontWeight:600}}>{item.value}</span>
            </div>
          ))}
        </Card>
        <div style={{textAlign:'center',padding:20}}>
          <img src={LOGO_URL} style={{width:60,height:60,borderRadius:30,marginBottom:8,objectFit:'contain'}} alt='logo' onError={e=>e.target.style.display='none'}/>
          <div style={{fontSize:13,fontWeight:700,color:th.primary}}>Bethel International Church</div>
          <div style={{fontSize:11,color:th.textLight,marginTop:2}}>Elmhurst, New York</div>
        </div>
      </div>
    </div></div>
  );
};
