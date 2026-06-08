import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, deleteDoc, query, orderBy, onSnapshot } from 'firebase/firestore';

const LOGO_URL = '/logo.png';
const th = {
  primary:'#1a3a6b', accent:'#c8a84b', accentLight:'#e8c96a',
  bg:'#f5f5f0', text:'#1a1a2e', textMid:'#4a5568', textLight:'#8a9ab5',
  border:'#e2e8f0', danger:'#e53e3e', success:'#38a169', warning:'#d69e2e',
};

const T = {
  en: {
    churchName:'Bethel International Church', churchCity:'New York', churchSub:'Living and Sharing the Gospel',
    login:'Sign In', email:'Email', password:'Password', loginBtn:'Sign In', signingIn:'Signing in...',
    noAccount:"No account?", regLink:'Register here', wrongCreds:'Invalid email or password.',
    fillAll:'Please fill in all fields.', regTitle:'Create Account', fullName:'Full Name', phone:'Phone',
    confirmPw:'Confirm Password', regBtn:'Create Account', registering:'Creating...',
    alreadyHave:'Already have an account?', signInLink:'Sign In',
    regSuccess:'Account created! Please sign in.', pwMismatch:'Passwords do not match.',
    emailTaken:'Email already registered.', fillAllReg:'Please fill in all required fields.',
    home:'Home', checkin:'Check In', give:'Give', schedule:'Schedule', bulletin:'Bulletin', profile:'Profile', report:'Report',
    goodMorning:'Good Morning', goodAfternoon:'Good Afternoon', goodEvening:'Good Evening',
    logout:'Sign Out', checkInTitle:'Check In', checkInSub:'Verify your location to check in',
    recentCI:'Recent Check-Ins', checkInNow:'Check In Now', locating:'Verifying location...',
    ciSuccess:'✓ Check In Successful!', tooFar:(d,r)=>`You are ${d}m away. Must be within ${r}m.`,
    noGps:'GPS not available.', denied:'Location access denied.', alreadyCI:'Already checked in today.',
    giveTitle:'Giving & Offerings', category:'Category', amount:'Amount', otherAmt:'Or enter amount',
    note:'Note (optional)', notePh:'For...', recordGive:'Record Giving', giveSuccess:'✓ Giving recorded!', history:'History',
    cats:{offering:'General Offering', tithe:'Tithe', mission:'Mission Fund', building:'Building Fund'},
    schedTitle:'Service Schedule', schedMonth:'This Week', all:'All', regular:'Service', youth:'Youth', prayer:'Prayer',
    typeLabels:{regular:'Service', youth:'Youth', prayer:'Prayer', cool:'COOL'},
    bulletinTitle:'Church Bulletin', postBtn:'Post', back:'← Back', publishBtn:'Publish',
    noBulletin:'No Bulletin Yet', noBulletinSub:'Post church announcements & news',
    reportTitle:'Reports', createBtn:'Create', submitRep:'Submit Report',
    noReport:'No Reports Yet', noReportSub:'Create activity or financial reports',
    rTypes:{activity:'Activity', finance:'Finance', ministry:'Ministry', other:'Other'}, by:'By:',
  },
  id: {
    churchName:'Bethel International Church', churchCity:'New York', churchSub:'Hidup dan Berbagi Injil',
    login:'Masuk', email:'Email', password:'Password', loginBtn:'Masuk', signingIn:'Memproses...',
    noAccount:'Belum punya akun?', regLink:'Daftar di sini', wrongCreds:'Email atau password salah.',
    fillAll:'Email dan password harus diisi.', regTitle:'Buat Akun', fullName:'Nama Lengkap', phone:'Nomor HP',
    confirmPw:'Konfirmasi Password', regBtn:'Daftar Sekarang', registering:'Mendaftarkan...',
    alreadyHave:'Sudah punya akun?', signInLink:'Masuk',
    regSuccess:'Akun berhasil dibuat! Silakan masuk.', pwMismatch:'Password tidak cocok.',
    emailTaken:'Email sudah terdaftar.', fillAllReg:'Semua kolom wajib diisi.',
    home:'Home', checkin:'Check In', give:'Donasi', schedule:'Jadwal', bulletin:'Warta', profile:'Profil', report:'Laporan',
    goodMorning:'Selamat Pagi', goodAfternoon:'Selamat Siang', goodEvening:'Selamat Malam',
    logout:'Keluar', checkInTitle:'Check In', checkInSub:'Verifikasi lokasi untuk check in',
    recentCI:'Riwayat Check In', checkInNow:'Check In Sekarang', locating:'Memverifikasi lokasi...',
    ciSuccess:'✓ Check In Berhasil!', tooFar:(d,r)=>`Kamu ${d}m dari gereja. Harus dalam ${r}m.`,
    noGps:'GPS tidak tersedia.', denied:'Akses lokasi ditolak.', alreadyCI:'Sudah check in hari ini.',
    giveTitle:'Donasi & Persembahan', category:'Kategori', amount:'Jumlah', otherAmt:'Atau masukkan jumlah',
    note:'Catatan (opsional)', notePh:'Untuk...', recordGive:'Catat Donasi', giveSuccess:'✓ Donasi tercatat!', history:'Riwayat',
    cats:{offering:'Persembahan Umum', tithe:'Perpuluhan', mission:'Dana Misi', building:'Dana Pembangunan'},
    schedTitle:'Jadwal Ibadah', schedMonth:'Minggu Ini', all:'Semua', regular:'Ibadah', youth:'Pemuda', prayer:'Doa',
    typeLabels:{regular:'Ibadah', youth:'Pemuda', prayer:'Doa', cool:'COOL'},
    bulletinTitle:'Warta Jemaat', postBtn:'Posting', back:'← Kembali', publishBtn:'Publikasikan',
    noBulletin:'Belum Ada Warta', noBulletinSub:'Post pengumuman dan berita gereja',
    reportTitle:'Laporan', createBtn:'Buat', submitRep:'Kirim Laporan',
    noReport:'Belum Ada Laporan', noReportSub:'Buat laporan kegiatan atau keuangan',
    rTypes:{activity:'Kegiatan', finance:'Keuangan', ministry:'Pelayanan', other:'Lainnya'}, by:'Oleh:',
  }
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
const CHURCH_LOC = {lat:40.7421,lng:-73.8803,radiusM:5};

const distM=(lat1,lon1,lat2,lon2)=>{
  const R=6371000,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
};
const toLocalDate=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d);};

const S={
  app:{maxWidth:430,margin:'0 auto',minHeight:'100vh',backgroundColor:'#f5f5f0',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',position:'relative'},
  card:{backgroundColor:'white',borderRadius:20,padding:16,marginBottom:12,boxShadow:'0 2px 8px rgba(0,0,0,0.06)'},
  btn:{backgroundColor:th.primary,color:'white',border:'none',borderRadius:14,padding:'14px 24px',fontSize:15,fontWeight:700,cursor:'pointer',width:'100%'},
  inp:{width:'100%',padding:13,fontSize:15,borderRadius:14,border:`2px solid ${th.border}`,outline:'none',boxSizing:'border-box',backgroundColor:'white'},
  label:{fontSize:13,fontWeight:600,color:th.textMid,marginBottom:6,display:'block'},
  screen:{padding:'0 0 100px',overflowY:'auto',height:'calc(100vh - 62px)'},
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
    {label&&<label style={S.label}>{label}</label>}
    <div style={{position:'relative',display:'flex',alignItems:'center',border:`2px solid ${th.border}`,borderRadius:14,backgroundColor:'white'}}>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
        style={{...S.inp,border:'none',flex:1}}/>
      {rightEl}
    </div>
  </div>
);

const Header=({lang,setLang,onBell,unreadCount,onLogout,t})=>(
  <div style={{backgroundColor:th.primary,padding:'50px 18px 12px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <img src={LOGO_URL} style={{width:30,height:30,borderRadius:15,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
      <div>
        <div style={{color:'white',fontWeight:700,fontSize:13}}>Bethel Int'l Church</div>
        <div style={{color:th.accentLight,fontSize:10}}>New York</div>
      </div>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <button onClick={()=>setLang(lang==='en'?'id':'en')} style={{backgroundColor:'rgba(255,255,255,0.15)',border:'1px solid rgba(255,255,255,0.25)',borderRadius:20,padding:'5px 12px',color:'white',fontWeight:700,fontSize:12,cursor:'pointer'}}>
        {lang.toUpperCase()}
      </button>
      <div style={{position:'relative',cursor:'pointer'}} onClick={onBell}>
        <span style={{fontSize:22}}>🔔</span>
        {unreadCount>0&&<div style={{position:'absolute',top:-4,right:-4,backgroundColor:th.danger,borderRadius:10,minWidth:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',padding:'0 4px'}}>
          <span style={{color:'white',fontSize:10,fontWeight:800}}>{unreadCount>9?'9+':unreadCount}</span>
        </div>}
      </div>
      <button onClick={onLogout} style={{background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:12,cursor:'pointer'}}>{t.logout}</button>
    </div>
  </div>
);

const BottomNav=({active,onNav,t})=>{
  const tabs=[{key:'home',label:t.home,icon:'🏠'},{key:'checkin',label:t.checkin,icon:'📍'},{key:'give',label:t.give,icon:'💝'},{key:'schedule',label:t.schedule,icon:'📅'},{key:'profile',label:t.profile,icon:'👤'}];
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
  const t=T[lang];
  const [email,setEmail]=useState('');
  const [pw,setPw]=useState('');
  const [showPw,setShowPw]=useState(false);
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const handleLogin=async()=>{
    setErr('');
    if(!email||!pw){setErr(t.fillAll);return;}
    setLoading(true);
    try{await signInWithEmailAndPassword(auth,email,pw);}
    catch(e){setErr(t.wrongCreds);setLoading(false);}
  };
  return(
    <div style={{minHeight:'100vh',backgroundColor:th.bg,overflowY:'auto'}}>
      <div style={{backgroundColor:th.primary,padding:'60px 32px 40px',textAlign:'center',position:'relative'}}>
        <button onClick={()=>setLang(lang==='en'?'id':'en')} style={{position:'absolute',top:16,right:16,backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 12px',color:'white',fontWeight:700,fontSize:12,cursor:'pointer'}}>{lang==='en'?'EN':'ID'} 🌐</button>
        <img src={LOGO_URL} style={{width:100,height:100,borderRadius:50,marginBottom:16,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
        <h2 style={{color:'white',margin:'0 0 4px',fontSize:22,fontWeight:700}}>{t.churchName}</h2>
        <div style={{color:th.accentLight,fontSize:13,fontWeight:600,marginBottom:4}}>{t.churchCity}</div>
        <div style={{color:'rgba(255,255,255,0.55)',fontSize:13}}>{t.churchSub}</div>
      </div>
      <div style={{padding:24}}>
        <h2 style={{textAlign:'center',fontSize:24,fontWeight:800,marginBottom:16}}>{lang==='id'?'Selamat Datang':'Welcome'}</h2>
        {regSuccess&&<div style={{backgroundColor:'#f0fff4',borderRadius:12,padding:12,marginBottom:16,color:th.success,fontWeight:600}}>✓ {t.regSuccess}</div>}
        {err&&<div style={{backgroundColor:'#fff5f5',borderRadius:12,padding:12,marginBottom:16,color:th.danger}}>{err}</div>}
        <Inp label={t.email} value={email} onChange={setEmail} placeholder="your@email.com" type="email"/>
        <Inp label={t.password} value={pw} onChange={setPw} placeholder="••••••••" type={showPw?'text':'password'}
          rightEl={<button onClick={()=>setShowPw(!showPw)} style={{background:'none',border:'none',cursor:'pointer',padding:'0 14px',fontSize:16}}>{showPw?'🙈':'👁️'}</button>}/>
        <Btn label={loading?t.signingIn:t.loginBtn} onClick={handleLogin} disabled={loading} style={{marginTop:4}}/>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:16,fontSize:13}}>
          <span style={{color:th.textLight}}>{t.noAccount}</span>
          <span onClick={onRegister} style={{color:th.primary,fontWeight:700,cursor:'pointer'}}>{t.regLink}</span>
        </div>
      </div>
    </div>
  );
};

const RegisterScreen=({lang,setLang,onBack,onRegistered})=>{
  const t=T[lang];
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [phone,setPhone]=useState('');
  const [pw,setPw]=useState('');
  const [pw2,setPw2]=useState('');
  const [err,setErr]=useState('');
  const [loading,setLoading]=useState(false);
  const handleReg=async()=>{
    setErr('');
    if(!name||!email||!pw||!pw2){setErr(t.fillAllReg);return;}
    if(pw!==pw2){setErr(t.pwMismatch);return;}
    setLoading(true);
    try{
      const cred=await createUserWithEmailAndPassword(auth,email,pw);
      await setDoc(doc(db,'members',cred.user.uid),{name,email,phone,role:'member',joinDate:new Date().toLocaleDateString(),createdAt:new Date().toISOString()});
      onRegistered();
    }catch(e){
      if(e.code==='auth/email-already-in-use')setErr(t.emailTaken);
      else setErr(e.message);
      setLoading(false);
    }
  };
  return(
    <div style={{minHeight:'100vh',backgroundColor:th.bg,overflowY:'auto'}}>
      <div style={{backgroundColor:th.primary,padding:'60px 32px 36px',textAlign:'center',position:'relative'}}>
        <button onClick={onBack} style={{position:'absolute',top:16,left:16,backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'6px 12px',color:'white',cursor:'pointer',fontSize:16}}>←</button>
        <img src={LOGO_URL} style={{width:80,height:80,borderRadius:40,marginBottom:14,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
        <h2 style={{color:'white',margin:'0 0 4px',fontSize:20,fontWeight:700}}>{t.regTitle}</h2>
      </div>
      <div style={{padding:24}}>
        {err&&<div style={{backgroundColor:'#fff5f5',borderRadius:12,padding:12,marginBottom:16,color:th.danger}}>{err}</div>}
        <Inp label={t.fullName} value={name} onChange={setName} placeholder="Your full name"/>
        <Inp label={t.email} value={email} onChange={setEmail} placeholder="your@email.com" type="email"/>
        <Inp label={t.phone} value={phone} onChange={setPhone} placeholder="+1 234 567 8900" type="tel"/>
        <Inp label={t.password} value={pw} onChange={setPw} placeholder="••••••••" type="password"/>
        <Inp label={t.confirmPw} value={pw2} onChange={setPw2} placeholder="••••••••" type="password"/>
        <Btn label={loading?t.registering:t.regBtn} onClick={handleReg} disabled={loading} style={{marginTop:8}}/>
        <div style={{display:'flex',justifyContent:'center',gap:6,marginTop:16,fontSize:13}}>
          <span style={{color:th.textLight}}>{t.alreadyHave}</span>
          <span onClick={onBack} style={{color:th.primary,fontWeight:700,cursor:'pointer'}}>{t.signInLink}</span>
        </div>
      </div>
    </div>
  );
};

const HomeScreen=({user,onNav,t,lang})=>{
  const hr=new Date().getHours();
  const greeting=hr<12?t.goodMorning:hr<17?t.goodAfternoon:t.goodEvening;
  const quickCards=[
    {key:'checkin',label:t.checkin,icon:'📍',bg:'#e8f4e8'},
    {key:'give',label:t.give,icon:'💝',bg:'#fff8e8'},
    {key:'bulletin',label:t.bulletin,icon:'📋',bg:'#e8eef8'},
    {key:'report',label:t.report,icon:'📄',bg:'#f8e8e8'},
  ];
  const verse=lang==='id'
    ? '"Karena itu pergilah, jadikanlah semua bangsa murid-Ku dan baptislah mereka dalam nama Bapa dan Anak dan Roh Kudus."'
    : '"Go therefore and make disciples of all the nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit."';
  return(
    <div style={S.screen}>
      <div style={{backgroundColor:th.bg,padding:'12px 16px 0'}}>
        <div style={{backgroundColor:th.primary,borderRadius:24,padding:22,boxShadow:`0 6px 16px ${th.primary}40`}}>
          <div style={{color:'rgba(255,255,255,0.65)',fontSize:13}}>{greeting},</div>
          <div style={{color:'white',fontSize:22,fontWeight:800,margin:'2px 0 10px'}}>{user.name||user.email}</div>
          <span style={{backgroundColor:'rgba(200,168,75,0.25)',borderRadius:20,padding:'5px 12px',color:th.accentLight,fontSize:11,fontWeight:700,letterSpacing:1,border:'1px solid rgba(200,168,75,0.5)'}}>
            {(user.role||'MEMBER').toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{padding:16}}>
        <div style={{marginBottom:16}}>
          {[[quickCards[0],quickCards[1]],[quickCards[2],quickCards[3]]].map((row,ri)=>(
            <div key={ri} style={{display:'flex',gap:10,marginBottom:10}}>
              {row.map(c=>(
                <div key={c.key} onClick={()=>onNav(c.key)} style={{backgroundColor:c.bg,borderRadius:18,padding:16,flex:1,cursor:'pointer',boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                  <div style={{fontSize:28,marginBottom:12}}>{c.icon}</div>
                  <div style={{fontSize:14,fontWeight:700,color:th.text}}>{c.label}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <Card>
          <div style={{fontSize:11,fontWeight:700,color:th.accent,marginBottom:10,letterSpacing:1.5,textTransform:'uppercase'}}>Matthew 28:19</div>
          <div style={{fontSize:15,color:th.text,lineHeight:1.7,fontStyle:'italic',marginBottom:12}}>{verse}</div>
          <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:10,borderTop:`1px solid ${th.border}`}}>
            <img src={LOGO_URL} style={{width:22,height:22,borderRadius:11,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
            <span style={{fontSize:11,color:th.textLight}}>Bethel Int'l Church · New York</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

const CheckInScreen=({user,t})=>{
  const [status,setStatus]=useState('idle');
  const [dist,setDist]=useState(null);
  const [checkins,setCheckins]=useState([]);
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'checkins'),snap=>{
      setCheckins(snap.docs.filter(d=>d.data().userId===user.uid).map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[user.uid]);
  const alreadyToday=()=>checkins.some(c=>c.date===new Date().toLocaleDateString());
  const handleCI=()=>{
    if(alreadyToday()){setStatus('already');return;}
    setStatus('locating');
    if(!navigator.geolocation){setStatus('no_gps');return;}
    navigator.geolocation.getCurrentPosition(
      async pos=>{
        const d=Math.round(distM(pos.coords.latitude,pos.coords.longitude,CHURCH_LOC.lat,CHURCH_LOC.lng));
        setDist(d);
        if(d<=CHURCH_LOC.radiusM){
          await addDoc(collection(db,'checkins'),{userId:user.uid,userName:user.name,locationName:'Main Sanctuary',distanceM:d,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
          setStatus('success');setTimeout(()=>setStatus('idle'),3000);
        }else setStatus('too_far');
      },
      err=>setStatus(err.code===1?'denied':'no_gps'),
      {enableHighAccuracy:true,timeout:10000,maximumAge:0}
    );
  };
  const si={
    success:{icon:'✅',msg:t.ciSuccess,color:th.success},
    too_far:{icon:'🚫',msg:t.tooFar(dist||0,CHURCH_LOC.radiusM),color:th.danger},
    no_gps:{icon:'📵',msg:t.noGps,color:th.danger},
    denied:{icon:'🔒',msg:t.denied,color:th.danger},
    already:{icon:'⚠️',msg:t.alreadyCI,color:th.warning},
    locating:{icon:'🔍',msg:t.locating,color:th.primary},
  }[status];
  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700,marginBottom:4}}>{t.checkInTitle}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13}}>{t.checkInSub}</div>
      </div>
      {si&&<div style={{backgroundColor:si.color+'15',borderRadius:14,padding:14,marginBottom:16,display:'flex',gap:10,border:`1px solid ${si.color}30`}}>
        <span style={{fontSize:20}}>{si.icon}</span>
        <span style={{color:si.color,fontWeight:600}}>{si.msg}</span>
      </div>}
      <Card>
        <div style={{display:'flex',gap:14,alignItems:'center'}}>
          <div style={{width:46,height:46,backgroundColor:th.bg,borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📍</div>
          <div>
            <div style={{fontSize:15,fontWeight:700,marginBottom:2}}>Main Sanctuary</div>
            <div style={{fontSize:12,color:th.textMid}}>87-07 Justice Ave, Elmhurst, NY 11373</div>
            <div style={{fontSize:11,color:th.primary,marginTop:4}}>📍 Radius: {CHURCH_LOC.radiusM}m</div>
          </div>
        </div>
      </Card>
      <Btn label={status==='locating'?t.locating:status==='success'?t.ciSuccess:t.checkInNow} onClick={handleCI} disabled={status==='locating'||status==='success'} style={{backgroundColor:status==='success'?th.success:th.primary}}/>
      {checkins.length>0&&<div style={{marginTop:20}}>
        <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>{t.recentCI}</div>
        {checkins.slice(-5).reverse().map(c=>(
          <div key={c.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:`1px solid ${th.border}`}}>
            <span style={{fontSize:22}}>✅</span>
            <div>
              <div style={{fontSize:14,fontWeight:600}}>{c.locationName}</div>
              <div style={{fontSize:12,color:th.textLight}}>{c.date}</div>
            </div>
          </div>
        ))}
      </div>}
    </div></div>
  );
};

const GiveScreen=({user,t,lang})=>{
  const [amount,setAmount]=useState('');
  const [cat,setCat]=useState('offering');
  const [note,setNote]=useState('');
  const [success,setSuccess]=useState(false);
  const [donations,setDonations]=useState([]);
  const presets=[25,50,100,200];
  const cats=Object.entries(t.cats).map(([k,v])=>({key:k,label:v}));
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'donations'),snap=>{
      setDonations(snap.docs.filter(d=>d.data().userId===user.uid).map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[user.uid]);
  const handleGive=async()=>{
    if(!amount)return;
    await addDoc(collection(db,'donations'),{userId:user.uid,userName:user.name,amount:parseFloat(amount),category:cat,note,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
    setSuccess(true);setAmount('');setNote('');setTimeout(()=>setSuccess(false),2500);
  };
  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16}}>
        <div style={{color:'white',fontSize:20,fontWeight:700}}>{t.giveTitle}</div>
      </div>
      <Card>
        <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{lang==='id'?'Donasi Online':'Online Giving'}</div>
        <div style={{backgroundColor:th.bg,borderRadius:14,padding:14,marginBottom:14}}>
          {[{l:'Bank',v:'Chase Bank'},{l:lang==='id'?'Nama':'Account Name',v:'Bethel International Church'},{l:'Zelle',v:'finance@bethelnyc.org'}].map((item,i)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:i<2?`1px solid ${th.border}`:'none'}}>
              <span style={{fontSize:13,color:th.textMid}}>{item.l}</span>
              <span style={{fontSize:13,fontWeight:600}}>{item.v}</span>
            </div>
          ))}
        </div>
        <a href="https://tithe.ly/give?c=BETHELNYC" target="_blank" rel="noreferrer" style={{display:'flex',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:th.primary,color:'white',borderRadius:14,padding:14,textDecoration:'none',fontWeight:700,fontSize:14,border:`2px solid ${th.accent}`,marginBottom:0}}>
          🙏 Give via Tithe.ly
        </a>
      </Card>
      <Card>
        <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:8,textTransform:'uppercase',letterSpacing:0.5}}>{t.category}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {cats.map(c=>(
            <button key={c.key} onClick={()=>setCat(c.key)} style={{padding:'8px 14px',borderRadius:12,border:`2px solid ${cat===c.key?th.primary:th.border}`,backgroundColor:cat===c.key?`${th.primary}15`:'white',cursor:'pointer',fontSize:12,fontWeight:600,color:cat===c.key?th.primary:th.textMid}}>
              {c.label}
            </button>
          ))}
        </div>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          {presets.map(p=>(
            <button key={p} onClick={()=>setAmount(String(p))} style={{flex:1,padding:'10px',borderRadius:12,border:`2px solid ${amount===String(p)?th.accent:th.border}`,backgroundColor:amount===String(p)?`${th.accent}15`:'white',cursor:'pointer',fontWeight:700,fontSize:13,color:amount===String(p)?th.primary:th.textMid}}>
              ${p}
            </button>
          ))}
        </div>
        <Inp label={t.otherAmt} value={amount} onChange={setAmount} placeholder="$0" type="number"/>
        <Inp label={t.note} value={note} onChange={setNote} placeholder={t.notePh}/>
        {success&&<div style={{backgroundColor:'#f0fff4',borderRadius:12,padding:12,marginBottom:12,color:th.success,fontWeight:600}}>{t.giveSuccess}</div>}
        <Btn label={t.recordGive} onClick={handleGive} disabled={!amount}/>
      </Card>
      {donations.length>0&&<div>
        <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:10,textTransform:'uppercase',letterSpacing:1}}>{t.history}</div>
        {donations.slice(-5).reverse().map(d=>(
          <Card key={d.id} style={{padding:14}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:14,fontWeight:700}}>{t.cats[d.category]||d.category}</div>
                <div style={{fontSize:12,color:th.textLight}}>{d.date}{d.note?` · ${d.note}`:''}</div>
              </div>
              <span style={{fontSize:16,fontWeight:700,color:th.success}}>${d.amount}</span>
            </div>
          </Card>
        ))}
      </div>}
    </div></div>
  );
};

const ScheduleScreen=({user,t,lang})=>{
  const [filter,setFilter]=useState('all');
  const [showAdd,setShowAdd]=useState(false);
  const [addTitle,setAddTitle]=useState('');
  const [addDate,setAddDate]=useState('');
  const [addTime,setAddTime]=useState('');
  const [addType,setAddType]=useState('regular');
  const [addContact,setAddContact]=useState('');
  const [addPhone,setAddPhone]=useState('');
  const [customSchedules,setCustomSchedules]=useState([]);
  const [editingId,setEditingId]=useState(null);
  const filters=[{key:'all',label:t.all},{key:'regular',label:t.regular},{key:'youth',label:t.youth},{key:'prayer',label:t.prayer},{key:'cool',label:'COOL'}];
  const typeColors={regular:{bg:'#e8eef8',color:th.primary},youth:{bg:'#e8f4e8',color:th.success},prayer:{bg:'#fff8e8',color:th.warning},cool:{bg:'#f3e8ff',color:'#7c3aed'}};
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'schedules'),snap=>{
      setCustomSchedules(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);
  const allSchedules=[...SCHEDULES,...customSchedules].sort((a,b)=>new Date(a.date)-new Date(b.date));
  const filtered=filter==='all'?allSchedules:allSchedules.filter(s=>s.type===filter);
  const handleAdd=async()=>{
    if(!addDate||!addTime)return;
    const data={title:addTitle||(t.typeLabels[addType]||addType),date:addDate,time:addTime,type:addType,contact:addContact,phone:addPhone,location:addType==='cool'?'':'87-07 Justice Ave, Elmhurst, NY',custom:true};
    if(editingId&&customSchedules.some(s=>s.id===editingId)){
      await setDoc(doc(db,'schedules',editingId),data);
    }else{
      await addDoc(collection(db,'schedules'),data);
    }
    setAddTitle('');setAddDate('');setAddTime('');setAddContact('');setAddPhone('');setEditingId(null);setShowAdd(false);
  };
  const handleDelete=async id=>await deleteDoc(doc(db,'schedules',id));
  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{backgroundColor:th.primary,borderRadius:20,padding:18,marginBottom:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{color:'white',fontSize:20,fontWeight:700}}>{t.schedTitle}</div>
          <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginTop:4}}>{t.schedMonth}</div>
        </div>
        {user.role==='admin'&&<button onClick={()=>setShowAdd(!showAdd)} style={{backgroundColor:th.accent,border:'none',borderRadius:20,padding:'7px 14px',color:th.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>{showAdd?'✕':'+ Add'}</button>}
      </div>
      {showAdd&&user.role==='admin'&&<Card>
        <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>{editingId?'Edit Schedule':'Add Schedule'}</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:14}}>
          {[{key:'regular',label:t.regular},{key:'youth',label:t.youth},{key:'prayer',label:t.prayer},{key:'cool',label:'COOL'}].map(tp=>(
            <button key={tp.key} onClick={()=>setAddType(tp.key)} style={{padding:'7px 14px',borderRadius:20,border:`2px solid ${addType===tp.key?(typeColors[tp.key]||{color:th.primary}).color:th.border}`,backgroundColor:addType===tp.key?(typeColors[tp.key]||{bg:'white'}).bg:'white',cursor:'pointer',fontSize:12,fontWeight:600,color:addType===tp.key?(typeColors[tp.key]||{color:th.primary}).color:th.textMid}}>{tp.label}</button>
          ))}
        </div>
        <Inp label="Title (optional)" value={addTitle} onChange={setAddTitle} placeholder="Event title..."/>
        <Inp label="Date (YYYY-MM-DD)" value={addDate} onChange={setAddDate} placeholder="2026-06-14"/>
        <Inp label="Time" value={addTime} onChange={setAddTime} placeholder="09:00 AM"/>
        {addType==='cool'&&<><Inp label="COOL Leader Name" value={addContact} onChange={setAddContact} placeholder="Leader name..."/><Inp label="Leader Phone" value={addPhone} onChange={setAddPhone} placeholder="+1 234 567 8900" type="tel"/></>}
        <Btn label={editingId?'Update':'Save'} onClick={handleAdd} disabled={!addDate||!addTime}/>
      </Card>}
      <div style={{display:'flex',gap:8,overflowX:'auto',marginBottom:14,paddingBottom:4}}>
        {filters.map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)} style={{padding:'8px 18px',borderRadius:20,border:`2px solid ${filter===f.key?th.primary:th.border}`,backgroundColor:filter===f.key?th.primary:'white',color:filter===f.key?'white':th.textMid,fontWeight:600,fontSize:13,cursor:'pointer',whiteSpace:'nowrap'}}>{f.label}</button>
        ))}
      </div>
      {filtered.map(s=>{
        const tc=typeColors[s.type]||{bg:'#e8eef8',color:th.primary};
        const d=toLocalDate(s.date);
        const isCustom=customSchedules.some(c=>c.id===s.id);
        return(
          <Card key={s.id}>
            <div style={{display:'flex',gap:14}}>
              <div style={{backgroundColor:th.primary,width:56,height:56,borderRadius:16,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{color:'white',fontSize:20,fontWeight:700,lineHeight:1}}>{d.getDate()}</span>
                <span style={{color:'rgba(255,255,255,0.7)',fontSize:9,textTransform:'uppercase'}}>{d.toLocaleDateString('en',{month:'short'})}</span>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:4}}>
                  <span style={{fontSize:14,fontWeight:700,flex:1}}>{s.title}</span>
                  <span style={{backgroundColor:tc.bg,borderRadius:20,padding:'3px 8px',fontSize:10,fontWeight:700,color:tc.color}}>{t.typeLabels[s.type]||s.type.toUpperCase()}</span>
                </div>
                <div style={{fontSize:12,color:th.textMid}}>🕐 {s.time}</div>
                {s.type!=='cool'&&s.location&&<div style={{fontSize:11,color:th.textLight,marginTop:2}}>📍 {s.location}</div>}
                {s.type==='cool'&&(s.contact||s.phone)&&<div style={{fontSize:12,color:th.primary,marginTop:4}}>{s.contact?`👤 ${s.contact}`:''}{s.contact&&s.phone?' · ':''}{s.phone?`📞 ${s.phone}`:''}</div>}
                {user.role==='admin'&&<div style={{display:'flex',gap:14,marginTop:6}}>
                  <span onClick={()=>{setEditingId(s.id);setAddTitle(s.title);setAddDate(s.date);setAddTime(s.time);setAddType(s.type);setAddContact(s.contact||'');setAddPhone(s.phone||'');setShowAdd(true);}} style={{fontSize:11,color:th.primary,fontWeight:600,cursor:'pointer'}}>✏️ Edit</span>
                  {isCustom&&<span onClick={()=>handleDelete(s.id)} style={{fontSize:11,color:th.danger,fontWeight:600,cursor:'pointer'}}>🗑 {lang==='id'?'Hapus':'Delete'}</span>}
                </div>}
              </div>
            </div>
          </Card>
        );
      })}
    </div></div>
  );
};

const BulletinScreen=({user,t,lang})=>{
  const [view,setView]=useState('list');
  const [title,setTitle]=useState('');
  const [content,setContent]=useState('');
  const [contentId,setContentId]=useState('');
  const [cat,setCat]=useState('announcement');
  const [writeLang,setWriteLang]=useState('id');
  const [filterCat,setFilterCat]=useState('all');
  const [bulletins,setBulletins]=useState([]);
  const catList=[
    {key:'announcement',label:lang==='id'?'Pengumuman':'Announcement',emoji:'📢',color:'#d69e2e'},
    {key:'devotional',label:lang==='id'?'Renungan':'Devotional',emoji:'✝️',color:'#1a3a6b'},
    {key:'news',label:lang==='id'?'Berita Gereja':'Church News',emoji:'📰',color:'#38a169'},
    {key:'event',label:lang==='id'?'Info Acara':'Event Info',emoji:'🎉',color:'#9b59b6'},
  ];
  useEffect(()=>{
    const unsub=onSnapshot(query(collection(db,'bulletins'),orderBy('timestamp','desc')),snap=>{
      setBulletins(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
    return unsub;
  },[]);
  const handleSave=async()=>{
    if(!content&&!contentId)return;
    const isDup=bulletins.some(b=>b.title===title&&(b.content||'')===content&&(b.contentId||'')===contentId);
    if(isDup){alert(lang==='id'?'Konten yang sama sudah pernah diposting.':'This content has already been posted.');return;}
    await addDoc(collection(db,'bulletins'),{userId:user.uid,userName:user.name,title,content,contentId,cat,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
    setTitle('');setContent('');setContentId('');setWriteLang('id');setCat('announcement');setView('list');
  };
  const handleDelete=async id=>await deleteDoc(doc(db,'bulletins',id));
  const filtered=filterCat==='all'?bulletins:bulletins.filter(b=>b.cat===filterCat);
  if(view==='write')return(
    <div style={S.screen}><div style={{padding:16}}>
      <div onClick={()=>setView('list')} style={{display:'flex',alignItems:'center',gap:8,marginBottom:20,cursor:'pointer',color:th.primary,fontWeight:700,fontSize:15}}>← {lang==='id'?'Kembali':'Back'}</div>
      <div style={{fontSize:12,fontWeight:700,color:th.textMid,marginBottom:10,textTransform:'uppercase'}}>{lang==='id'?'Kategori':'Category'}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {catList.map(cl=>(
          <button key={cl.key} onClick={()=>setCat(cl.key)} style={{padding:'8px 14px',borderRadius:20,border:`2px solid ${cat===cl.key?cl.color:th.border}`,backgroundColor:cat===cl.key?`${cl.color}20`:'white',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:cat===cl.key?cl.color:th.textMid}}>
            {cl.emoji} {cl.label}
          </button>
        ))}
      </div>
      <label style={S.label}>{lang==='id'?'Judul':'Title'}</label>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder={lang==='id'?'Judul bulletin...':'Bulletin title...'} style={{...S.inp,marginBottom:16}}/>
      <div style={{display:'flex',marginBottom:14,borderRadius:14,overflow:'hidden',border:`2px solid ${th.border}`}}>
        <button onClick={()=>setWriteLang('id')} style={{flex:1,padding:'12px',border:'none',backgroundColor:writeLang==='id'?th.primary:'white',color:writeLang==='id'?'white':th.textMid,fontWeight:700,fontSize:13,cursor:'pointer'}}>🇮🇩 Indonesia</button>
        <button onClick={()=>setWriteLang('en')} style={{flex:1,padding:'12px',border:'none',backgroundColor:writeLang==='en'?th.primary:'white',color:writeLang==='en'?'white':th.textMid,fontWeight:700,fontSize:13,cursor:'pointer'}}>🇺🇸 English</button>
      </div>
      {writeLang==='id'?<><label style={S.label}>Konten Bahasa Indonesia 🇮🇩</label><textarea value={contentId} onChange={e=>setContentId(e.target.value)} placeholder="Tulis konten dalam Bahasa Indonesia..." rows={8} style={{...S.inp,height:200,resize:'vertical',marginBottom:16}}/></>
      :<><label style={S.label}>English Content 🇺🇸</label><textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Write content in English..." rows={8} style={{...S.inp,height:200,resize:'vertical',marginBottom:16}}/></>}
      <div style={{backgroundColor:th.bg,borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${th.border}`}}>
        <div style={{fontSize:11,fontWeight:700,color:th.textMid,marginBottom:8,textTransform:'uppercase'}}>Preview</div>
        <div style={{fontSize:12,lineHeight:1.6}}>🇮🇩 {contentId?contentId.slice(0,100)+'...':'(belum diisi)'}</div>
        <div style={{fontSize:12,lineHeight:1.6,marginTop:6}}>🇺🇸 {content?content.slice(0,100)+'...':'(not filled yet)'}</div>
      </div>
      <Btn label={lang==='id'?'Publikasikan':'Publish'} onClick={handleSave} disabled={!content&&!contentId}/>
    </div></div>
  );
  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:700}}>{lang==='id'?'Warta Jemaat':'Church Bulletin'}</div>
          <div style={{color:th.textMid,fontSize:13}}>{bulletins.length} {lang==='id'?'edisi':'editions'}</div>
        </div>
        {user.role==='admin'?<button onClick={()=>setView('write')} style={{backgroundColor:th.accent,border:'none',borderRadius:20,padding:'8px 16px',color:th.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>{lang==='id'?'Posting':'Post'}</button>
        :<span style={{backgroundColor:'rgba(26,58,107,0.08)',borderRadius:20,padding:'6px 12px',fontSize:11,fontWeight:600,color:th.textMid}}>👁 {lang==='id'?'Hanya baca':'Read only'}</span>}
      </div>
      <div style={{display:'flex',gap:8,overflowX:'auto',marginBottom:14,paddingBottom:4}}>
        <button onClick={()=>setFilterCat('all')} style={{padding:'7px 16px',borderRadius:20,border:`2px solid ${filterCat==='all'?th.primary:th.border}`,backgroundColor:filterCat==='all'?th.primary:'white',color:filterCat==='all'?'white':th.textMid,fontWeight:600,fontSize:12,cursor:'pointer',whiteSpace:'nowrap'}}>{lang==='id'?'Semua':'All'}</button>
        {catList.map(cl=>(
          <button key={cl.key} onClick={()=>setFilterCat(cl.key)} style={{padding:'7px 16px',borderRadius:20,border:`2px solid ${filterCat===cl.key?cl.color:th.border}`,backgroundColor:filterCat===cl.key?cl.color:'white',color:filterCat===cl.key?'white':th.textMid,fontWeight:600,fontSize:12,cursor:'pointer',display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap'}}>
            {cl.emoji} {cl.label}
          </button>
        ))}
      </div>
      {filtered.length===0?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:48,marginBottom:16}}>📋</div><div style={{fontSize:18,fontWeight:700,marginBottom:8}}>{lang==='id'?'Belum Ada Warta':'No Bulletin Yet'}</div></div>
      :filtered.map(b=>{
        const cl=catList.find(x=>x.key===b.cat)||catList[0];
        const displayContent=lang==='id'?(b.contentId||b.content):(b.content||b.contentId);
        return(
          <Card key={b.id}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <span style={{backgroundColor:`${cl.color}20`,borderRadius:20,padding:'4px 10px',fontSize:11,fontWeight:700,color:cl.color}}>{cl.emoji} {cl.label}</span>
              <span style={{fontSize:11,color:th.textLight}}>{b.date}</span>
            </div>
            {b.title&&<div style={{fontSize:17,fontWeight:700,marginBottom:8,lineHeight:1.5}}>{b.title}</div>}
            <div style={{fontSize:14,color:th.textMid,lineHeight:1.7,marginBottom:10}}>{displayContent}</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:10,borderTop:`1px solid ${th.border}`}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <img src={LOGO_URL} style={{width:22,height:22,borderRadius:11,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
                <span style={{fontSize:11,color:th.textLight}}>Bethel Int'l Church · New York</span>
              </div>
              {user.role==='admin'&&<button onClick={()=>handleDelete(b.id)} style={{backgroundColor:'#fff0f0',border:'none',borderRadius:20,padding:'4px 10px',fontSize:11,color:th.danger,fontWeight:700,cursor:'pointer'}}>🗑 {lang==='id'?'Hapus':'Delete'}</button>}
            </div>
          </Card>
        );
      })}
    </div></div>
  );
};

const ReportScreen=({user,t,lang})=>{
  const [view,setView]=useState('list');
  const [title,setTitle]=useState('');
  const [content,setContent]=useState('');
  const [type,setType]=useState('activity');
  const [reports,setReports]=useState([]);
  const types=Object.entries(t.rTypes).map(([k,v])=>({key:k,label:v}));
  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'reports'),snap=>{
      const all=snap.docs.map(d=>({id:d.id,...d.data()}));
      setReports(user.role==='admin'?all:all.filter(r=>r.userId===user.uid));
    });
    return unsub;
  },[user.uid,user.role]);
  const handleSubmit=async()=>{
    if(!title||!content)return;
    await addDoc(collection(db,'reports'),{userId:user.uid,userName:user.name,title,content,type,date:new Date().toLocaleDateString(),timestamp:new Date().toISOString()});
    setTitle('');setContent('');setView('list');
  };
  if(view==='write')return(
    <div style={S.screen}><div style={{padding:16}}>
      <div onClick={()=>setView('list')} style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,cursor:'pointer',color:th.primary,fontWeight:700}}>← {lang==='id'?'Kembali':'Back'}</div>
      <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
        {types.map(tp=>(<button key={tp.key} onClick={()=>setType(tp.key)} style={{padding:'8px 14px',borderRadius:12,border:`2px solid ${type===tp.key?th.primary:th.border}`,backgroundColor:type===tp.key?`${th.primary}10`:'white',cursor:'pointer',fontSize:13,fontWeight:600,color:type===tp.key?th.primary:th.textMid}}>{tp.label}</button>))}
      </div>
      <Inp label={lang==='id'?'Judul':'Title'} value={title} onChange={setTitle} placeholder={lang==='id'?'Judul...':'Title...'}/>
      <label style={S.label}>{lang==='id'?'Isi Laporan':'Content'}</label>
      <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder={lang==='id'?'Tuliskan laporan...':'Write your report...'} rows={6} style={{...S.inp,height:160,resize:'vertical',marginBottom:16}}/>
      <Btn label={t.submitRep} onClick={handleSubmit} disabled={!title||!content}/>
    </div></div>
  );
  return(
    <div style={S.screen}><div style={{padding:16}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div><div style={{fontSize:20,fontWeight:700}}>{t.reportTitle}</div><div style={{color:th.textMid,fontSize:13}}>{reports.length} {lang==='id'?'laporan':'reports'}</div></div>
        <button onClick={()=>setView('write')} style={{backgroundColor:th.accent,border:'none',borderRadius:20,padding:'8px 16px',color:th.primary,fontWeight:700,fontSize:13,cursor:'pointer'}}>{t.createBtn}</button>
      </div>
      {reports.length===0?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:48,marginBottom:16}}>📄</div><div style={{fontSize:18,fontWeight:700}}>{t.noReport}</div></div>
      :reports.slice().reverse().map(r=>{
        const tp=types.find(x=>x.key===r.type);
        return(<Card key={r.id}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
            <div><div style={{fontSize:15,fontWeight:700,marginBottom:5}}>{r.title}</div><span style={{backgroundColor:th.bg,borderRadius:20,padding:'3px 10px',fontSize:11,fontWeight:700,color:th.textMid}}>{tp?.label}</span></div>
            <span style={{fontSize:11,color:th.textLight}}>{r.date}</span>
          </div>
          <div style={{fontSize:13,color:th.textMid,lineHeight:1.6,marginTop:8}}>{r.content}</div>
          {user.role==='admin'&&<div style={{fontSize:12,color:th.textLight,marginTop:8}}>{t.by} {r.userName}</div>}
        </Card>);
      })}
    </div></div>
  );
};

const ProfileScreen=({user,setUser,lang,t})=>{
  const [editing,setEditing]=useState(false);
  const [name,setName]=useState(user.name||'');
  const [email,setEmail]=useState(user.email||'');
  const [phone,setPhone]=useState(user.phone||'');
  const [address,setAddress]=useState(user.address||'');
  const [saved,setSaved]=useState(false);
  const handleSave=async()=>{
    await setDoc(doc(db,'members',user.uid),{name,email,phone,address,role:user.role,joinDate:user.joinDate,updatedAt:new Date().toISOString()},{merge:true});
    setUser({...user,name,email,phone,address});setSaved(true);setEditing(false);setTimeout(()=>setSaved(false),2500);
  };
  const initials=(user.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  return(
    <div style={S.screen}><div style={{paddingBottom:40}}>
      <div style={{backgroundColor:th.primary,padding:'30px 24px 50px',textAlign:'center'}}>
        <div style={{width:90,height:90,borderRadius:45,backgroundColor:th.accent,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 14px',border:'3px solid rgba(255,255,255,0.3)'}}>
          <span style={{fontSize:32,fontWeight:800,color:th.primary}}>{initials}</span>
        </div>
        <div style={{color:'white',fontSize:20,fontWeight:700,marginBottom:4}}>{user.name}</div>
        <div style={{color:'rgba(255,255,255,0.6)',fontSize:13,marginBottom:10}}>{user.email}</div>
        <span style={{backgroundColor:'rgba(200,168,75,0.25)',borderRadius:20,padding:'5px 14px',color:th.accentLight,fontSize:12,fontWeight:700,letterSpacing:1}}>{(user.role||'MEMBER').toUpperCase()}</span>
      </div>
      <div style={{padding:16,marginTop:-28}}>
        {saved&&<div style={{backgroundColor:'#f0fff4',borderRadius:14,padding:12,marginBottom:14,display:'flex',gap:8,alignItems:'center'}}><span style={{fontSize:16}}>✅</span><span style={{color:th.success,fontWeight:600}}>{lang==='id'?'Profil berhasil disimpan!':'Profile saved successfully!'}</span></div>}
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <span style={{fontSize:16,fontWeight:700}}>{lang==='id'?'Informasi Pribadi':'Personal Information'}</span>
            <button onClick={()=>setEditing(!editing)} style={{backgroundColor:editing?'#fff5f5':`${th.primary}10`,border:`1px solid ${editing?th.danger:th.primary}`,borderRadius:20,padding:'6px 14px',fontSize:13,fontWeight:600,color:editing?th.danger:th.primary,cursor:'pointer'}}>
              {editing?(lang==='id'?'Batal':'Cancel'):(lang==='id'?'Edit':'Edit')}
            </button>
          </div>
          {[{label:lang==='id'?'Nama Lengkap':'Full Name',value:name,set:setName},{label:'Email',value:email,set:setEmail},{label:lang==='id'?'No. HP':'Phone',value:phone,set:setPhone},{label:lang==='id'?'Alamat':'Address',value:address,set:setAddress}].map((item,i)=>(
            <div key={i} style={{marginBottom:14}}>
              <div style={{fontSize:11,fontWeight:700,color:th.textLight,marginBottom:5,textTransform:'uppercase'}}>{item.label}</div>
              {editing?<input value={item.value} onChange={e=>item.set(e.target.value)} style={{...S.inp,backgroundColor:th.bg}}/>
              :<div style={{fontSize:15,color:th.text,fontWeight:500}}>{item.value||'-'}</div>}
            </div>
          ))}
          {editing&&<Btn label={lang==='id'?'Simpan Perubahan':'Save Changes'} onClick={handleSave} style={{marginTop:6}}/>}
        </Card>
        <Card>
          <div style={{fontSize:16,fontWeight:700,marginBottom:14}}>{lang==='id'?'Info Keanggotaan':'Membership Info'}</div>
          {[{label:lang==='id'?'Gereja':'Church',value:'Bethel International Church'},{label:lang==='id'?'Lokasi':'Location',value:'Elmhurst, New York'},{label:lang==='id'?'Tanggal Bergabung':'Join Date',value:user.joinDate||'-'},{label:'Status',value:lang==='id'?'Jemaat Aktif':'Active Member'}].map((item,i,arr)=>(
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<arr.length-1?`1px solid ${th.border}`:'none'}}>
              <span style={{fontSize:13,color:th.textMid}}>{item.label}</span>
              <span style={{fontSize:13,fontWeight:600,color:th.text}}>{item.value}</span>
            </div>
          ))}
        </Card>
        <div style={{textAlign:'center',padding:20}}>
          <img src={LOGO_URL} style={{width:60,height:60,borderRadius:30,marginBottom:8,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
          <div style={{fontSize:13,fontWeight:700,color:th.primary}}>Bethel International Church</div>
          <div style={{fontSize:11,color:th.textLight,marginTop:2}}>Elmhurst, New York</div>
        </div>
      </div>
    </div></div>
  );
};

export default function App(){
  const [lang,setLang]=useState(localStorage.getItem('churchLang')||'en');
  const [user,setUser]=useState(null);
  const [screen,setScreen]=useState('login');
  const [regSuccess,setRegSuccess]=useState(false);
  const [activeTab,setActiveTab]=useState('home');
  const [showNotif,setShowNotif]=useState(false);
  const [clearedNotifs,setClearedNotifs]=useState([]);
  const [bulletins,setBulletins]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const t=T[lang];

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async fireUser=>{
      if(fireUser){
        const snap=await getDoc(doc(db,'members',fireUser.uid));
        setUser({uid:fireUser.uid,email:fireUser.email,...(snap.exists()?snap.data():{})});
      }else setUser(null);
      setLoaded(true);
    });
    return unsub;
  },[]);

  useEffect(()=>{
    const unsub=onSnapshot(query(collection(db,'bulletins'),orderBy('timestamp','desc')),snap=>setBulletins(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return unsub;
  },[]);

  useEffect(()=>{localStorage.setItem('churchLang',lang);},[lang]);

  const notifs=bulletins.slice(0,3).map(b=>({id:'bull_'+b.id,type:'bulletin',bulletin:b}));
  const unreadCount=notifs.filter(n=>!clearedNotifs.includes(n.id)).length;

  if(!loaded)return(
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:'100vh',backgroundColor:th.primary}}>
      <img src={LOGO_URL} style={{width:80,height:80,borderRadius:40,marginBottom:20,objectFit:'contain'}} alt="logo" onError={e=>e.target.style.display='none'}/>
      <div style={{color:'white',fontSize:16}}>Loading...</div>
    </div>
  );

  if(!user)return(
    <div style={S.app}>
      {screen==='register'
        ?<RegisterScreen lang={lang} setLang={setLang} onBack={()=>setScreen('login')} onRegistered={()=>{setScreen('login');setRegSuccess(true);setTimeout(()=>setRegSuccess(false),5000);}}/>
        :<LoginScreen lang={lang} setLang={setLang} onRegister={()=>{setScreen('register');setRegSuccess(false);}} regSuccess={regSuccess}/>
      }
    </div>
  );

  const renderScreen=()=>{
    switch(activeTab){
      case 'home':     return <HomeScreen user={user} onNav={setActiveTab} t={t} lang={lang}/>;
      case 'checkin':  return <CheckInScreen user={user} t={t} lang={lang}/>;
      case 'give':     return <GiveScreen user={user} t={t} lang={lang}/>;
      case 'schedule': return <ScheduleScreen user={user} t={t} lang={lang}/>;
      case 'bulletin': return <BulletinScreen user={user} t={t} lang={lang}/>;
      case 'report':   return <ReportScreen user={user} t={t} lang={lang}/>;
      case 'profile':  return <ProfileScreen user={user} setUser={setUser} lang={lang} t={t}/>;
      default: return null;
    }
  };

  return(
    <div style={S.app}>
      <Header lang={lang} setLang={setLang} onBell={()=>setShowNotif(true)} unreadCount={unreadCount} onLogout={()=>signOut(auth)} t={t}/>
      <div style={{flex:1}}>{renderScreen()}</div>
      <BottomNav active={activeTab} onNav={setActiveTab} t={t}/>
      {showNotif&&<div style={{position:'fixed',top:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,height:'100vh',backgroundColor:th.bg,zIndex:1000,display:'flex',flexDirection:'column'}}>
        <div style={{backgroundColor:th.primary,padding:16,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{color:'white',fontSize:18,fontWeight:700}}>🔔 {lang==='id'?'Notifikasi':'Notifications'}</span>
          <div style={{display:'flex',gap:10}}>
            <button onClick={()=>setClearedNotifs(notifs.map(n=>n.id))} style={{backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 12px',color:'rgba(255,255,255,0.85)',fontSize:12,fontWeight:600,cursor:'pointer'}}>{lang==='id'?'Hapus Semua':'Clear All'}</button>
            <button onClick={()=>setShowNotif(false)} style={{backgroundColor:'rgba(255,255,255,0.15)',border:'none',borderRadius:20,padding:'5px 12px',color:'white',fontSize:12,fontWeight:600,cursor:'pointer'}}>{lang==='id'?'Tutup':'Close'}</button>
          </div>
        </div>
        <div style={{overflowY:'auto',flex:1,padding:16}}>
          {notifs.filter(n=>!clearedNotifs.includes(n.id)).length===0
            ?<div style={{textAlign:'center',padding:48}}><div style={{fontSize:40,marginBottom:12}}>🔔</div><div style={{fontSize:16,fontWeight:700,color:th.textMid}}>{lang==='id'?'Tidak ada notifikasi':'No notifications'}</div></div>
            :notifs.filter(n=>!clearedNotifs.includes(n.id)).map(n=>{
              const b=n.bulletin;
              return(
                <div key={n.id} onClick={()=>{setActiveTab('bulletin');setShowNotif(false);}} style={{backgroundColor:'white',borderRadius:18,padding:16,marginBottom:10,boxShadow:'0 2px 6px rgba(0,0,0,0.05)',borderLeft:`4px solid ${th.accent}`,cursor:'pointer'}}>
                  <div style={{display:'flex',gap:12,alignItems:'center'}}>
                    <span style={{fontSize:32}}>📋</span>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,color:th.warning,fontSize:14,marginBottom:4}}>{lang==='id'?'Warta Terbaru':'New Bulletin'}</div>
                      <div style={{fontSize:13,color:th.text,fontWeight:600}}>{b.title||'(No Title)'}</div>
                      <div style={{fontSize:12,color:th.textMid,marginTop:2}}>{b.date}</div>
                    </div>
                    <span style={{fontSize:18,color:th.textLight}}>›</span>
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
