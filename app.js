const $=id=>document.getElementById(id);
async function status(){
  const r=await fetch('/api/status'); const d=await r.json();
  if(d.connected){
    $('status').textContent=`Подключён: @${d.creator?.creator_username||'TikTok'}`;
    $('connect').textContent='TikTok подключён';
    $('post').disabled=false;
  }
}
$('connect').onclick=()=>location.href='/auth/tiktok';
$('make').onclick=()=>{
  const idea=$('idea').value.trim()||'смешная ситуация из жизни';
  $('script').textContent=`Хук: «Кто тоже так делает?»\n\nСцена 1: ${idea}.\nСцена 2: неожиданный поворот.\nФинал: короткая шутка + призыв «У кого было — ставь ❤️».`;
};
$('post').onclick=async()=>{
  const r=await fetch('/api/post',{method:'POST'}); const d=await r.json();
  $('status').textContent=d.error||'Готово';
};
status();
