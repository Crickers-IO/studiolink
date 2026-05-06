import { useState, useRef, useEffect, useCallback } from "react";

const initialTracks = [
  { id:1, name:"Verse Drums v3.wav",       artist:"Marco", avatar:"M", type:"drums",  size:"24.3 MB", bpm:92,  key:null, uploaded:"2h ago",  comments:3,  status:"approved",        color:"#FF6B35", audioUrl:null },
  { id:2, name:"Bass Line final.aiff",     artist:"Sasha", avatar:"S", type:"bass",   size:"18.7 MB", bpm:92,  key:"Am", uploaded:"5h ago",  comments:7,  status:"review",          color:"#4ECDC4", audioUrl:null },
  { id:3, name:"Lead Guitar take 6.wav",   artist:"Priya", avatar:"P", type:"guitar", size:"31.2 MB", bpm:null,key:"Am", uploaded:"1d ago",  comments:12, status:"approved",        color:"#FFE66D", audioUrl:null },
  { id:4, name:"Synth Pad atmosphere.wav", artist:"Leo",   avatar:"L", type:"synth",  size:"9.8 MB",  bpm:null,key:"Am", uploaded:"2d ago",  comments:2,  status:"needs-revision",  color:"#C77DFF", audioUrl:null },
  { id:5, name:"Vocal Main hook.wav",      artist:"Zara",  avatar:"Z", type:"vocals", size:"15.4 MB", bpm:null,key:"A",  uploaded:"3d ago",  comments:19, status:"approved",        color:"#F72585", audioUrl:null },
];

const seedComments = {
  1:[
    {id:1,user:"Marco",avatar:"M",color:"#FF6B35",text:"Updated with tighter snare hits, let me know!",time:"2h ago"},
    {id:2,user:"Priya",avatar:"P",color:"#FFE66D",text:"Sounds way better, groove is locked in 🔥",time:"1h ago"},
    {id:3,user:"Sasha",avatar:"S",color:"#4ECDC4",text:"Can we try ghost notes in the verse?",time:"45m ago"},
  ],
  2:[
    {id:1,user:"Leo",avatar:"L",color:"#C77DFF",text:"Bass tone is perfect under my synth pad",time:"5h ago"},
    {id:2,user:"Zara",avatar:"Z",color:"#F72585",text:"Sits perfectly under my vocal 🎤",time:"4h ago"},
  ],
  5:[
    {id:1,user:"Marco",avatar:"M",color:"#FF6B35",text:"The hook in bar 2 is INSANE",time:"3d ago"},
    {id:2,user:"Leo",avatar:"L",color:"#C77DFF",text:"Ad-libs at 1:45 gave me chills",time:"2d ago"},
  ],
};

const TYPE_ICONS = {drums:"🥁",bass:"🎸",guitar:"🎸",synth:"🎹",vocals:"🎤"};
const STATUS_CFG = {
  approved:        {label:"Approved",        bg:"rgba(78,205,196,0.15)", color:"#4ECDC4",dot:"#4ECDC4"},
  review:          {label:"In Review",       bg:"rgba(255,230,109,0.15)",color:"#FFE66D",dot:"#FFE66D"},
  "needs-revision":{label:"Needs Revision",  bg:"rgba(247,37,133,0.15)", color:"#F72585",dot:"#F72585"},
};

const fmt = s => {
  if (!isFinite(s)||s<0) return "0:00";
  const m=Math.floor(s/60), sec=Math.floor(s%60);
  return `${m}:${sec.toString().padStart(2,"0")}`;
};

const makeFakeWave = (id,n=120) =>
  Array.from({length:n},(_,i)=>{
    const t=i/n;
    return Math.abs(Math.sin(t*Math.PI*(7+id))*0.5+Math.sin(t*Math.PI*(13+id*3))*0.3+Math.sin(t*Math.PI*(31+id))*0.2);
  });

// ── Waveform canvas ──────────────────────────────────────────────────────────
function WaveformCanvas({peaks,progress,color,onSeek}){
  const ref=useRef();
  useEffect(()=>{
    const c=ref.current; if(!c||!peaks?.length) return;
    const ctx=c.getContext("2d"), W=c.width, H=c.height;
    ctx.clearRect(0,0,W,H);
    const bw=W/peaks.length, splitX=progress*W;
    peaks.forEach((v,i)=>{
      const x=i*bw, h=Math.max(2,v*(H-4)), y=(H-h)/2;
      ctx.fillStyle=x<splitX?color:"rgba(255,255,255,0.1)";
      ctx.beginPath(); ctx.roundRect(x+.5,y,Math.max(1,bw-1),h,1); ctx.fill();
    });
  },[peaks,progress,color]);
  return(
    <canvas ref={ref} width={560} height={52} style={{width:"100%",height:52,cursor:"pointer",display:"block"}}
      onClick={e=>{const r=e.currentTarget.getBoundingClientRect();onSeek((e.clientX-r.left)/r.width);}}/>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function StudioCollab(){
  const [tracks,setTracks]             = useState(initialTracks);
  const [activeTrack,setActiveTrack]   = useState(null);
  const [activePanel,setActivePanel]   = useState("files");
  const [dragging,setDragging]         = useState(false);
  const [filter,setFilter]             = useState("all");
  const [uploadProgress,setUploadProgress] = useState(null);
  const [allComments,setAllComments]   = useState(seedComments);
  const [newComment,setNewComment]     = useState("");

  // playback
  const [playingId,setPlayingId]   = useState(null);
  const [paused,setPaused]         = useState(true);
  const [currentTime,setCurrentTime] = useState(0);
  const [duration,setDuration]     = useState(0);
  const [volume,setVolume]         = useState(0.8);
  const [muted,setMuted]           = useState(false);
  const [loadingId,setLoadingId]   = useState(null);
  const [waveforms,setWaveforms]   = useState(()=>{
    const w={}; initialTracks.forEach(t=>{w[t.id]=makeFakeWave(t.id);}); return w;
  });

  const audioRef    = useRef(null);
  const rafRef      = useRef(null);
  const fileInputRef= useRef();

  // ── init audio element once ──
  useEffect(()=>{
    const a=new Audio();
    a.crossOrigin="anonymous";
    audioRef.current=a;
    const onEnded=()=>{setPaused(true);setPlayingId(null);};
    const onPause =()=>setPaused(true);
    const onPlay  =()=>setPaused(false);
    a.addEventListener("ended",onEnded);
    a.addEventListener("pause",onPause);
    a.addEventListener("play",onPlay);
    return()=>{a.removeEventListener("ended",onEnded);a.removeEventListener("pause",onPause);a.removeEventListener("play",onPlay);a.src="";};
  },[]);

  // ── RAF ticker ──
  useEffect(()=>{
    const tick=()=>{
      const a=audioRef.current;
      if(a){setCurrentTime(a.currentTime);setDuration(isFinite(a.duration)?a.duration:0);}
      rafRef.current=requestAnimationFrame(tick);
    };
    rafRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);

  // ── volume sync ──
  useEffect(()=>{if(audioRef.current) audioRef.current.volume=muted?0:volume;},[volume,muted]);

  // ── play/pause a track ──
  const playTrack=useCallback(async(track)=>{
    const a=audioRef.current; if(!a) return;
    if(playingId===track.id){
      if(a.paused){await a.play();}else{a.pause();}
      return;
    }
    a.pause(); a.src="";
    if(!track.audioUrl){
      // Demo mode: fake playback state, no real audio
      setPlayingId(track.id); setPaused(false);
      setCurrentTime(0); setDuration(154);
      // fake position drift for visual feedback
      return;
    }
    setLoadingId(track.id);
    try{
      a.src=track.audioUrl; a.volume=muted?0:volume;
      await a.play();
      setPlayingId(track.id);
    }catch(e){console.warn("Playback error:",e);}
    setLoadingId(null);
  },[playingId,volume,muted]);

  // ── demo ticker (fake drift when no real audio) ──
  useEffect(()=>{
    if(!playingId) return;
    const t=tracks.find(t=>t.id===playingId);
    if(!t||t.audioUrl) return; // real audio handles itself
    if(paused) return;
    const iv=setInterval(()=>setCurrentTime(p=>{if(p>=154){clearInterval(iv);setPaused(true);setPlayingId(null);return 0;}return p+0.25;}),250);
    return()=>clearInterval(iv);
  },[playingId,paused,tracks]);

  const seek=useCallback((ratio)=>{
    const a=audioRef.current;
    const target=ratio*(duration||154);
    if(a&&isFinite(a.duration)) a.currentTime=target;
    setCurrentTime(target);
  },[duration]);

  // ── build real waveform from uploaded file ──
  const buildWaveform=useCallback(async(arrayBuffer,trackId)=>{
    try{
      const actx=new(window.AudioContext||window.webkitAudioContext)();
      const decoded=await actx.decodeAudioData(arrayBuffer.slice(0));
      const ch=decoded.getChannelData(0), N=120, step=Math.floor(ch.length/N);
      const peaks=Array.from({length:N},(_,i)=>{
        let max=0; for(let j=0;j<step;j++){const v=Math.abs(ch[i*step+j]||0);if(v>max)max=v;} return max;
      });
      const mx=Math.max(...peaks,0.001);
      setWaveforms(p=>({...p,[trackId]:peaks.map(v=>v/mx)}));
      await actx.close();
    }catch(_){}
  },[]);

  // ── upload handler ──
  const handleUpload=useCallback((file)=>{
    if(!file||!file.type.startsWith("audio/")) return;
    setUploadProgress(0);
    const reader=new FileReader();
    reader.onprogress=e=>{if(e.lengthComputable)setUploadProgress(Math.round(e.loaded/e.total*100));};
    reader.onload=async e=>{
      setUploadProgress(100);
      const buf=e.target.result;
      const url=URL.createObjectURL(file);
      const id=Date.now();
      const newTrack={id,name:file.name,artist:"You",avatar:"Y",type:"guitar",size:`${(file.size/1024/1024).toFixed(1)} MB`,bpm:null,key:null,uploaded:"Just now",comments:0,status:"review",color:"#A8DAFF",audioUrl:url};
      setTracks(p=>[newTrack,...p]);
      setWaveforms(p=>({...p,[id]:makeFakeWave(id)}));
      await buildWaveform(buf,id);
      setTimeout(()=>setUploadProgress(null),700);
    };
    reader.readAsArrayBuffer(file);
  },[buildWaveform]);

  const handleDrop=e=>{e.preventDefault();setDragging(false);handleUpload(Array.from(e.dataTransfer.files).find(f=>f.type.startsWith("audio/")));};

  // derived
  const effectiveDuration = duration||154;
  const progress          = effectiveDuration>0 ? Math.min(1, currentTime/effectiveDuration) : 0;
  const nowTrack          = tracks.find(t=>t.id===playingId)||null;
  const filtered          = filter==="all"?tracks:tracks.filter(t=>t.status===filter);

  return(
    <div style={{minHeight:"100vh",background:"#0A0A0F",fontFamily:"'DM Mono','Courier New',monospace",color:"#E8E8F0",display:"flex",flexDirection:"column"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Syne:wght@400;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:2px}
        .tr{transition:background .15s,transform .12s;cursor:pointer}
        .tr:hover{background:rgba(255,255,255,0.04)!important;transform:translateX(2px)}
        .tr.sel{background:rgba(255,255,255,0.07)!important}
        .btn{transition:all .18s;border:none;cursor:pointer;font-family:'DM Mono',monospace}
        .btn:hover{opacity:.78}.btn:active{transform:scale(.95)}
        .chip{transition:all .18s;cursor:pointer;border:none;font-family:'DM Mono',monospace}
        .chip:hover{opacity:.78}
        .dz{transition:all .2s}
        .dz:hover{border-color:rgba(168,218,255,.5)!important;background:rgba(168,218,255,.04)!important}
        input{font-family:'DM Mono',monospace}input:focus{outline:none}
        @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .22s ease forwards}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}.live{animation:pulse 1.6s ease-in-out infinite}
        @keyframes spin{to{transform:rotate(360deg)}}.spin{animation:spin .75s linear infinite;display:inline-block}
        input[type=range]{-webkit-appearance:none;height:4px;border-radius:2px;cursor:pointer;border:none;background:transparent}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:#A8DAFF;cursor:pointer;margin-top:-4px}
        input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px}
      `}</style>

      {/* ── HEADER ── */}
      <header style={{padding:"0 26px",height:58,display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(10,10,15,.97)",backdropFilter:"blur(20px)",position:"sticky",top:0,zIndex:100}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <div style={{width:29,height:29,background:"linear-gradient(135deg,#A8DAFF,#F72585)",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>◈</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13,letterSpacing:".02em"}}>STUDIOLINK</div>
            <div style={{fontSize:9,color:"#555",letterSpacing:".1em"}}>REMOTE SESSIONS</div>
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:13}}>Midnight Reverie EP</div>
          <div style={{fontSize:9,color:"#555",letterSpacing:".06em"}}>Track 1 · "Falling Slow" · A minor · 92 BPM</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
          {["M","S","P","L","Z"].map((l,i)=>(
            <div key={i} style={{width:25,height:25,borderRadius:"50%",background:initialTracks[i].color,border:"2px solid #0A0A0F",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#0A0A0F",marginLeft:i>0?-8:0}}>{l}</div>
          ))}
          <div style={{width:7,height:7,borderRadius:"50%",background:"#4ECDC4",boxShadow:"0 0 7px #4ECDC4",marginLeft:6}} className="live"/>
          <span style={{fontSize:9,color:"#4ECDC4"}}>LIVE</span>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── SIDEBAR ── */}
        <aside style={{width:205,background:"#0D0D14",borderRight:"1px solid rgba(255,255,255,.05)",padding:"18px 0",display:"flex",flexDirection:"column",gap:3}}>
          {[{id:"files",icon:"◧",label:"Files"},{id:"sessions",icon:"⊞",label:"Sessions"},{id:"activity",icon:"∿",label:"Activity"}].map(item=>(
            <button key={item.id} className="btn" onClick={()=>setActivePanel(item.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",background:activePanel===item.id?"rgba(168,218,255,.08)":"transparent",color:activePanel===item.id?"#A8DAFF":"#555",fontSize:12,borderLeft:activePanel===item.id?"2px solid #A8DAFF":"2px solid transparent",textAlign:"left"}}>
              <span style={{fontSize:14}}>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{margin:"14px 16px 5px",height:1,background:"rgba(255,255,255,.05)"}}/>
          <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:10}}>
            {[{l:"Tracks",v:tracks.length},{l:"Approved",v:`${tracks.filter(t=>t.status==="approved").length}/${tracks.length}`},{l:"Storage",v:"99.4 MB"}].map(s=>(
              <div key={s.l}>
                <div style={{fontSize:9,color:"#444",letterSpacing:".1em",marginBottom:1}}>{s.l.toUpperCase()}</div>
                <div style={{fontSize:15,fontFamily:"'Syne',sans-serif",fontWeight:700,color:"#A8DAFF"}}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{flex:1}}/>
          <div style={{padding:"0 16px 6px"}}>
            <button className="btn" onClick={()=>fileInputRef.current?.click()} style={{width:"100%",padding:"9px",background:"linear-gradient(135deg,rgba(168,218,255,.1),rgba(247,37,133,.07))",border:"1px solid rgba(168,218,255,.2)",borderRadius:7,color:"#A8DAFF",fontSize:11,letterSpacing:".05em"}}>
              + Upload Track
            </button>
            <input ref={fileInputRef} type="file" accept="audio/*" style={{display:"none"}} onChange={e=>handleUpload(e.target.files[0])}/>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",paddingBottom:nowTrack?84:0}}>

          {/* Upload progress */}
          {uploadProgress!==null&&(
            <div style={{background:"rgba(168,218,255,.04)",borderBottom:"1px solid rgba(168,218,255,.1)",padding:"7px 22px",display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:10,color:"#A8DAFF"}}>Uploading…</span>
              <div style={{flex:1,height:3,background:"rgba(255,255,255,.08)",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${uploadProgress}%`,background:"linear-gradient(90deg,#A8DAFF,#F72585)",borderRadius:2,transition:"width .1s"}}/>
              </div>
              <span style={{fontSize:10,color:"#A8DAFF",minWidth:32}}>{uploadProgress}%</span>
            </div>
          )}

          {/* ── FILES ── */}
          {activePanel==="files"&&(
            <div style={{display:"flex",flex:1,overflow:"hidden"}}>

              {/* list */}
              <div style={{flex:1,overflow:"auto",padding:20}}>

                {/* filters */}
                <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center"}}>
                  <span style={{fontSize:9,color:"#444",letterSpacing:".08em",marginRight:3}}>FILTER</span>
                  {[{id:"all",label:"All"},{id:"approved",label:"Approved"},{id:"review",label:"In Review"},{id:"needs-revision",label:"Needs Revision"}].map(f=>(
                    <button key={f.id} className="chip" onClick={()=>setFilter(f.id)} style={{padding:"3px 9px",borderRadius:20,background:filter===f.id?"rgba(168,218,255,.12)":"transparent",border:filter===f.id?"1px solid rgba(168,218,255,.3)":"1px solid rgba(255,255,255,.08)",color:filter===f.id?"#A8DAFF":"#555",fontSize:10}}>{f.label}</button>
                  ))}
                </div>

                {/* drop zone */}
                <div className="dz" onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop}
                  style={{border:`1px dashed ${dragging?"rgba(168,218,255,.5)":"rgba(255,255,255,.08)"}`,borderRadius:10,padding:14,marginBottom:16,textAlign:"center",background:dragging?"rgba(168,218,255,.03)":"transparent",cursor:"pointer"}}
                  onClick={()=>fileInputRef.current?.click()}>
                  <div style={{fontSize:20,marginBottom:3}}>⊕</div>
                  <div style={{fontSize:11,color:"#444"}}>Drop audio files or click to upload</div>
                  <div style={{fontSize:9,color:"#333",marginTop:2}}>WAV · AIFF · MP3 · FLAC</div>
                </div>

                {/* column headers */}
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 70px 80px 110px 50px",gap:6,padding:"5px 12px",fontSize:9,color:"#333",letterSpacing:".1em",borderBottom:"1px solid rgba(255,255,255,.04)",marginBottom:2}}>
                  <span>FILE</span><span>ARTIST</span><span>TIME</span><span>SIZE</span><span>STATUS</span><span></span>
                </div>

                {filtered.map((track,i)=>{
                  const isThis=playingId===track.id;
                  const isLoad=loadingId===track.id;
                  return(
                    <div key={track.id} className={`tr fu ${activeTrack?.id===track.id?"sel":""}`}
                      style={{display:"grid",gridTemplateColumns:"2fr 1fr 70px 80px 110px 50px",gap:6,padding:"10px 12px",borderRadius:7,borderBottom:"1px solid rgba(255,255,255,.03)",animationDelay:`${i*.04}s`}}
                      onClick={()=>setActiveTrack(activeTrack?.id===track.id?null:track)}>

                      {/* name + play btn */}
                      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                        <button className="btn" onClick={e=>{e.stopPropagation();playTrack(track);}} style={{width:25,height:25,borderRadius:"50%",background:isThis?"rgba(168,218,255,.18)":"rgba(255,255,255,.06)",border:`1px solid ${isThis?"rgba(168,218,255,.4)":"rgba(255,255,255,.1)"}`,color:isThis?"#A8DAFF":"#888",fontSize:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {isLoad?<span className="spin" style={{fontSize:8}}>◌</span>:isThis&&!paused?"⏸":"▶"}
                        </button>
                        <div style={{minWidth:0}}>
                          <div style={{fontSize:12,color:isThis?"#A8DAFF":"#E8E8F0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{track.name}</div>
                          <div style={{fontSize:9,color:"#444",marginTop:1}}>{track.bpm&&`${track.bpm} BPM · `}{track.key&&`${track.key} · `}{track.uploaded}</div>
                        </div>
                      </div>

                      {/* artist */}
                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{width:19,height:19,borderRadius:"50%",background:track.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"#0A0A0F"}}>{track.avatar}</div>
                        <span style={{fontSize:11,color:"#888"}}>{track.artist}</span>
                      </div>

                      <div style={{fontSize:11,color:"#666",display:"flex",alignItems:"center"}}>
                        {isThis?fmt(currentTime):fmt(154)}
                      </div>
                      <div style={{fontSize:11,color:"#666",display:"flex",alignItems:"center"}}>{track.size}</div>

                      {/* status */}
                      <div style={{display:"flex",alignItems:"center"}}>
                        <div style={{padding:"3px 6px",borderRadius:4,background:STATUS_CFG[track.status].bg,color:STATUS_CFG[track.status].color,fontSize:9,letterSpacing:".04em",display:"flex",alignItems:"center",gap:4}}>
                          <div style={{width:4,height:4,borderRadius:"50%",background:STATUS_CFG[track.status].dot}}/>
                          {STATUS_CFG[track.status].label}
                        </div>
                      </div>

                      {/* comments */}
                      <div style={{display:"flex",alignItems:"center",gap:3,color:track.comments>0?"#888":"#333",fontSize:11}}>
                        <span>◎</span><span>{track.comments}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── DETAIL PANEL ── */}
              {activeTrack&&(
                <aside style={{width:305,borderLeft:"1px solid rgba(255,255,255,.05)",background:"#0D0D14",display:"flex",flexDirection:"column",overflow:"hidden"}} className="fu">

                  <div style={{padding:"16px 16px 12px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:9}}>
                      <span style={{fontSize:24}}>{TYPE_ICONS[activeTrack.type]}</span>
                      <button className="btn" onClick={()=>setActiveTrack(null)} style={{background:"transparent",color:"#444",fontSize:14,padding:3}}>✕</button>
                    </div>
                    <div style={{fontSize:13,fontFamily:"'Syne',sans-serif",fontWeight:600,marginBottom:3,color:"#E8E8F0"}}>{activeTrack.name}</div>
                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                      <div style={{width:19,height:19,borderRadius:"50%",background:activeTrack.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,fontWeight:700,color:"#0A0A0F"}}>{activeTrack.avatar}</div>
                      <span style={{fontSize:10,color:"#888"}}>by {activeTrack.artist}</span>
                      <span style={{fontSize:9,color:"#444"}}>· {activeTrack.uploaded}</span>
                    </div>

                    {/* waveform */}
                    <div style={{background:"rgba(255,255,255,.02)",borderRadius:8,padding:"7px 8px 5px",marginBottom:10}}>
                      <WaveformCanvas
                        peaks={waveforms[activeTrack.id]||makeFakeWave(activeTrack.id)}
                        progress={playingId===activeTrack.id?progress:0}
                        color={activeTrack.color}
                        onSeek={ratio=>{if(playingId===activeTrack.id)seek(ratio);}}
                      />
                      <div style={{display:"flex",justifyContent:"space-between",marginTop:3}}>
                        <span style={{fontSize:9,color:"#444"}}>{playingId===activeTrack.id?fmt(currentTime):"0:00"}</span>
                        <span style={{fontSize:9,color:"#444"}}>{fmt(playingId===activeTrack.id?effectiveDuration:154)}</span>
                      </div>
                    </div>

                    {/* play / rewind */}
                    <div style={{display:"flex",gap:7,marginBottom:9,alignItems:"center"}}>
                      <button className="btn" onClick={()=>playTrack(activeTrack)} style={{flex:1,padding:"7px",background:playingId===activeTrack.id?"rgba(168,218,255,.18)":"rgba(168,218,255,.07)",border:"1px solid rgba(168,218,255,.2)",borderRadius:7,color:"#A8DAFF",fontSize:12}}>
                        {loadingId===activeTrack.id?<span className="spin">◌</span>:playingId===activeTrack.id&&!paused?"⏸ Pause":"▶ Play"}
                      </button>
                      <button className="btn" onClick={()=>seek(0)} style={{padding:"7px 11px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:7,color:"#666",fontSize:11}} title="Rewind to start">⏮</button>
                      {!activeTrack.audioUrl&&<div style={{fontSize:8,color:"#555",letterSpacing:".06em"}}>DEMO</div>}
                    </div>

                    {/* status */}
                    <div style={{display:"flex",gap:5}}>
                      {["approved","review","needs-revision"].map(s=>(
                        <button key={s} className="btn" onClick={()=>{setTracks(p=>p.map(t=>t.id===activeTrack.id?{...t,status:s}:t));setActiveTrack(p=>({...p,status:s}));}} style={{flex:1,padding:"5px 3px",background:activeTrack.status===s?STATUS_CFG[s].bg:"transparent",border:`1px solid ${activeTrack.status===s?STATUS_CFG[s].color+"55":"rgba(255,255,255,.07)"}`,borderRadius:4,color:activeTrack.status===s?STATUS_CFG[s].color:"#444",fontSize:8,letterSpacing:".04em",textAlign:"center"}}>
                          {s==="approved"?"✓ OK":s==="review"?"? Review":"↩ Revise"}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* comments */}
                  <div style={{flex:1,overflow:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
                    <div style={{fontSize:9,color:"#444",letterSpacing:".1em",marginBottom:1}}>NOTES & FEEDBACK ({(allComments[activeTrack.id]||[]).length})</div>
                    {(allComments[activeTrack.id]||[]).map(c=>(
                      <div key={c.id} style={{display:"flex",gap:8}} className="fu">
                        <div style={{width:22,height:22,borderRadius:"50%",background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#0A0A0F",flexShrink:0}}>{c.avatar}</div>
                        <div>
                          <div style={{display:"flex",gap:6,alignItems:"baseline",marginBottom:2}}>
                            <span style={{fontSize:10,color:"#A8DAFF"}}>{c.user}</span>
                            <span style={{fontSize:9,color:"#333"}}>{c.time}</span>
                          </div>
                          <div style={{fontSize:11,color:"#C0C0D0",lineHeight:1.5}}>{c.text}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* comment input */}
                  <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
                    <input value={newComment} onChange={e=>setNewComment(e.target.value)}
                      onKeyDown={e=>{
                        if(e.key==="Enter"&&newComment.trim()){
                          const c={id:Date.now(),user:"You",avatar:"Y",color:"#A8DAFF",text:newComment,time:"Just now"};
                          setAllComments(p=>({...p,[activeTrack.id]:[...(p[activeTrack.id]||[]),c]}));
                          setTracks(p=>p.map(t=>t.id===activeTrack.id?{...t,comments:t.comments+1}:t));
                          setNewComment("");
                        }
                      }}
                      placeholder="Add feedback… (Enter to post)"
                      style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:6,padding:"7px 10px",color:"#E8E8F0",fontSize:11}}
                    />
                  </div>
                </aside>
              )}
            </div>
          )}

          {/* ── SESSIONS ── */}
          {activePanel==="sessions"&&(
            <div style={{flex:1,padding:26,overflow:"auto"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,marginBottom:5}}>Session Log</div>
              <div style={{fontSize:11,color:"#555",marginBottom:20}}>Recent activity across all collaborators</div>
              {[
                {user:"Zara",avatar:"Z",color:"#F72585",action:"uploaded",file:"Vocal Main hook.wav",time:"3 days ago"},
                {user:"Priya",avatar:"P",color:"#FFE66D",action:"commented on",file:"Verse Drums v3.wav",time:"4 days ago"},
                {user:"Leo",avatar:"L",color:"#C77DFF",action:"approved",file:"Bass Line final.aiff",time:"5 days ago"},
                {user:"Marco",avatar:"M",color:"#FF6B35",action:"uploaded",file:"Verse Drums v3.wav",time:"6 days ago"},
                {user:"Sasha",avatar:"S",color:"#4ECDC4",action:"uploaded",file:"Bass Line final.aiff",time:"1 week ago"},
              ].map((ev,i)=>(
                <div key={i} className="fu" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.04)",animationDelay:`${i*.05}s`}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:ev.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#0A0A0F",flexShrink:0}}>{ev.avatar}</div>
                  <div style={{flex:1}}>
                    <span style={{color:"#A8DAFF",fontSize:12}}>{ev.user}</span>
                    <span style={{color:"#555",fontSize:12}}> {ev.action} </span>
                    <span style={{color:"#888",fontSize:12}}>{ev.file}</span>
                  </div>
                  <div style={{fontSize:10,color:"#444"}}>{ev.time}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {activePanel==="activity"&&(
            <div style={{flex:1,padding:26,overflow:"auto"}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,marginBottom:20}}>Project Overview</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:13,marginBottom:26}}>
                {[{l:"Total Tracks",v:tracks.length,c:"#A8DAFF"},{l:"Approved",v:tracks.filter(t=>t.status==="approved").length,c:"#4ECDC4"},{l:"Pending",v:tracks.filter(t=>t.status!=="approved").length,c:"#FFE66D"}].map(s=>(
                  <div key={s.l} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:16}}>
                    <div style={{fontSize:32,fontFamily:"'Syne',sans-serif",fontWeight:800,color:s.c}}>{s.v}</div>
                    <div style={{fontSize:9,color:"#555",marginTop:3,letterSpacing:".08em"}}>{s.l.toUpperCase()}</div>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:12,marginBottom:11,color:"#888"}}>Track Progress</div>
              {tracks.map(t=>(
                <div key={t.id} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:11,color:"#888"}}>{TYPE_ICONS[t.type]} {t.name}</span>
                    <span style={{fontSize:9,color:STATUS_CFG[t.status].color}}>{STATUS_CFG[t.status].label}</span>
                  </div>
                  <div style={{height:3,background:"rgba(255,255,255,.06)",borderRadius:2}}>
                    <div style={{height:"100%",width:t.status==="approved"?"100%":t.status==="review"?"60%":"30%",background:STATUS_CFG[t.status].color,borderRadius:2,transition:"width .5s ease",opacity:.7}}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── TRANSPORT BAR ── */}
      {nowTrack&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,height:80,background:"rgba(8,8,12,.98)",backdropFilter:"blur(28px)",borderTop:"1px solid rgba(255,255,255,.09)",display:"flex",alignItems:"center",padding:"0 22px",gap:16,zIndex:200}} className="fu">

          {/* now playing */}
          <div style={{display:"flex",alignItems:"center",gap:9,minWidth:170,maxWidth:210}}>
            <div style={{width:36,height:36,borderRadius:8,background:`linear-gradient(135deg,${nowTrack.color}22,${nowTrack.color}55)`,border:`1px solid ${nowTrack.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>
              {TYPE_ICONS[nowTrack.type]}
            </div>
            <div style={{minWidth:0}}>
              <div style={{fontSize:11,color:"#E8E8F0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontFamily:"'Syne',sans-serif",fontWeight:600}}>{nowTrack.name}</div>
              <div style={{fontSize:9,color:"#555",marginTop:1}}>{nowTrack.artist}{!nowTrack.audioUrl&&" · DEMO"}</div>
            </div>
          </div>

          {/* center: buttons + scrubber */}
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <button className="btn" onClick={()=>seek(0)} style={{background:"transparent",color:"#555",fontSize:13,padding:"2px 3px"}}>⏮</button>
              <button className="btn" onClick={()=>playTrack(nowTrack)} style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,rgba(168,218,255,.18),rgba(247,37,133,.12))",border:"1px solid rgba(168,218,255,.3)",color:"#A8DAFF",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {!paused?"⏸":"▶"}
              </button>
              <button className="btn" onClick={()=>{audioRef.current?.pause();setPlayingId(null);setPaused(true);}} style={{background:"transparent",color:"#555",fontSize:13,padding:"2px 3px"}}>⏹</button>
            </div>

            {/* scrub bar */}
            <div style={{display:"flex",alignItems:"center",gap:8,width:"100%",maxWidth:480}}>
              <span style={{fontSize:9,color:"#555",minWidth:32,textAlign:"right"}}>{fmt(currentTime)}</span>
              <div style={{flex:1,position:"relative",height:4,background:"rgba(255,255,255,.1)",borderRadius:2,cursor:"pointer"}}
                onClick={e=>{const r=e.currentTarget.getBoundingClientRect();seek((e.clientX-r.left)/r.width);}}>
                <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${progress*100}%`,background:`linear-gradient(90deg,${nowTrack.color},#A8DAFF)`,borderRadius:2,transition:"width .08s"}}/>
                <div style={{position:"absolute",top:"50%",left:`${progress*100}%`,transform:"translate(-50%,-50%)",width:10,height:10,borderRadius:"50%",background:"#A8DAFF",boxShadow:`0 0 6px ${nowTrack.color}`,pointerEvents:"none"}}/>
              </div>
              <span style={{fontSize:9,color:"#555",minWidth:32}}>{fmt(effectiveDuration)}</span>
            </div>
          </div>

          {/* volume */}
          <div style={{display:"flex",alignItems:"center",gap:7,minWidth:120}}>
            <button className="btn" onClick={()=>setMuted(m=>!m)} style={{background:"transparent",color:muted?"#F72585":"#666",fontSize:14,padding:"2px 3px"}}>
              {muted||volume===0?"🔇":volume<0.4?"🔈":"🔊"}
            </button>
            <input type="range" min={0} max={1} step={0.01} value={muted?0:volume}
              onChange={e=>{setVolume(parseFloat(e.target.value));setMuted(false);}}
              style={{flex:1,accentColor:"#A8DAFF",background:`linear-gradient(to right,rgba(168,218,255,.7) ${(muted?0:volume)*100}%,rgba(255,255,255,.1) ${(muted?0:volume)*100}%)`}}
            />
          </div>

          <button className="btn" onClick={()=>{audioRef.current?.pause();setPlayingId(null);setPaused(true);}} style={{background:"transparent",color:"#444",fontSize:15,padding:3,flexShrink:0}}>✕</button>
        </div>
      )}
    </div>
  );
}
