// Injected onto every proxied HTML page. Self-contained (no Canva DOM deps):
// a fixed "Live Engine" panel that calls the real /api/verify + /api/anchor and
// renders the persisted ledger. This is how delta.genesisconductor.io's UI is
// "wired" to the backend without owning Canva's markup.
export const WIDGET_HTML = `
<style>
  #dte-fab{position:fixed;right:18px;bottom:18px;z-index:2147483646;background:#ff3d9a;color:#fff;
    border:none;border-radius:999px;padding:12px 18px;font:600 14px/1 system-ui,sans-serif;
    cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35)}
  #dte-panel{position:fixed;right:18px;bottom:74px;z-index:2147483647;width:360px;max-width:92vw;
    max-height:78vh;overflow:auto;display:none;background:#0c0f1a;color:#e8ecf6;border:1px solid #25304d;
    border-radius:16px;padding:16px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.5)}
  #dte-panel.open{display:block}
  #dte-panel h3{margin:0 0 4px;font-size:15px;color:#fff}
  #dte-panel .sub{color:#8b97b5;font-size:11px;margin-bottom:12px}
  #dte-panel textarea{width:100%;box-sizing:border-box;background:#121726;color:#e8ecf6;border:1px solid #25304d;
    border-radius:10px;padding:9px;font:13px system-ui;resize:vertical;min-height:54px}
  #dte-panel .row{display:flex;gap:8px;margin-top:8px}
  #dte-panel button.act{flex:1;border:none;border-radius:10px;padding:9px;font:600 13px system-ui;cursor:pointer}
  #dte-verify{background:#2b6cff;color:#fff}#dte-anchor{background:#27e070;color:#06210f}
  #dte-out{margin-top:12px;display:none}
  #dte-out.show{display:block}
  .dte-bar{height:8px;border-radius:6px;background:#1a2236;overflow:hidden;margin:6px 0}
  .dte-bar>i{display:block;height:100%}
  .dte-kv{display:flex;justify-content:space-between;margin:3px 0;color:#aeb8d4}
  .dte-tier{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:11px;text-transform:uppercase}
  .dte-led{font-size:11px;color:#8b97b5;border-top:1px solid #1a2236;margin-top:12px;padding-top:8px}
  .dte-led code{color:#ff3d9a}
  #dte-panel a{color:#6ea8ff}
</style>
<button id="dte-fab">Δ Live Engine</button>
<div id="dte-panel">
  <h3>Δ Truth Engine — Live</h3>
  <div class="sub">RTPTPA verification · on-chain anchor · D1 ledger</div>
  <textarea id="dte-claim" placeholder="Enter a claim to verify…">A Mediterranean diet extends median lifespan</textarea>
  <div class="row">
    <button class="act" id="dte-verify">Verify</button>
    <button class="act" id="dte-anchor">Anchor</button>
  </div>
  <div id="dte-out"></div>
  <div class="dte-led" id="dte-led">loading ledger…</div>
</div>
<script data-cfasync="false">
(function(){
  var TIER={aligned:"#27e070",tension:"#f5b544",divergent:"#ff5d5d"};
  var fab=document.getElementById("dte-fab"),panel=document.getElementById("dte-panel"),
      out=document.getElementById("dte-out"),led=document.getElementById("dte-led"),
      claim=document.getElementById("dte-claim"),last=null;
  fab.onclick=function(){panel.classList.toggle("open");if(panel.classList.contains("open"))loadLedger();};
  function pct(x){return Math.round(x*100);}
  function render(r){
    last=r;var c=TIER[r.tier]||"#888";
    out.className="show";out.innerHTML=
      '<div><span class="dte-tier" style="background:'+c+';color:#06210f">'+r.tier+'</span>'+
      (r.anchored?' <span style="color:#27e070">⛓ block #'+r.block+'</span>':'')+'</div>'+
      '<div class="dte-bar"><i style="width:'+pct(r.div)+'%;background:'+c+'"></i></div>'+
      '<div class="dte-kv"><span>Divergence</span><b>'+r.div+'</b></div>'+
      '<div class="dte-kv"><span>Tension</span><b>'+r.tension+'</b></div>'+
      '<div class="dte-kv"><span>Consensus</span><b>'+r.consensus+'%</b></div>'+
      '<div class="dte-kv"><span>Confidence</span><b>'+r.confidence+'%</b></div>'+
      '<div class="dte-kv"><span>Oracles</span><b>'+(r.oracle_divs||[]).join(' · ')+'</b></div>'+
      (r.hash?'<div class="dte-kv"><span>Hash</span><code>'+r.hash+'</code></div>':'')+
      (r.onchain_tx?'<div class="dte-kv"><span>On-chain</span><a target="_blank" href="'+r.onchain_url+'">'+r.onchain_tx.slice(0,10)+'…</a></div>':'')+
      (r.cached?'<div class="dte-kv"><span style="color:#5b6b8f">cache</span><span>hit</span></div>':'');
  }
  function busy(b){document.getElementById("dte-verify").disabled=b;document.getElementById("dte-anchor").disabled=b;}
  document.getElementById("dte-verify").onclick=function(){
    var q=claim.value.trim();if(!q)return;busy(true);out.className="show";out.innerHTML="verifying…";
    fetch("/api/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({claim:q})})
      .then(function(r){return r.json();}).then(render).catch(function(e){out.innerHTML="error: "+e;}).finally(function(){busy(false);});
  };
  document.getElementById("dte-anchor").onclick=function(){
    var q=claim.value.trim();if(!q)return;busy(true);out.className="show";out.innerHTML="anchoring…";
    fetch("/api/anchor",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({claim:q})})
      .then(function(r){return r.json();}).then(function(r){render(r);loadLedger();}).catch(function(e){out.innerHTML="error: "+e;}).finally(function(){busy(false);});
  };
  function loadLedger(){
    fetch("/api/ledger?limit=5").then(function(r){return r.json();}).then(function(d){
      var rows=(d.anchors||[]).map(function(a){return '#'+a.block+' <code>'+a.hash+'</code> '+(a.statement||'').slice(0,24);}).join('<br>');
      led.innerHTML='<b>Ledger</b> · block '+d.current_block+' · '+d.anchored_total+' anchored<br>'+(rows||'(empty)');
    }).catch(function(){led.innerHTML="ledger unavailable";});
  }
})();
</script>`;
