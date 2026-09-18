import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const $ = id => document.getElementById(id);
let supabase = null;
let allOrders = [];

function initSupabase(){
  if(!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY){
    $('loginError').textContent='مفاتيح Supabase غير موجودة';
    $('loginError').style.display='block';
    return false;
  }
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
  return true;
}

async function loadOrders(){
  const listEl = $('ordersList');
  if(!listEl) return;
  listEl.innerHTML='⏳ جاري التحميل...';
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at',{ascending:false})
    .limit(200);
  
  if(error){
    listEl.innerHTML=`<div class="error-box" style="display:block">${error.message}</div>`;
    return;
  }
  allOrders = data||[];
  renderOrders(allOrders);
  renderStats(allOrders);
}

function renderStats(orders){
  const today = new Date().toISOString().slice(0,10);
  const todayCount = orders.filter(o=> (o.created_at||'').slice(0,10)===today).length;
  const pending = orders.filter(o=>o.status==='pending').length;
  const todayEl = $('statToday'), pendingEl = $('statPending'), totalEl = $('statTotal');
  if(todayEl) todayEl.textContent = todayCount;
  if(pendingEl) pendingEl.textContent = pending;
  if(totalEl) totalEl.textContent = orders.length;
}

function renderOrders(list){
  const listEl = $('ordersList');
  if(!listEl) return;
  if(list.length===0){
    listEl.innerHTML='<p style="text-align:center;color:#999">لا توجد طلبات</p>';
    return;
  }
  listEl.innerHTML = list.map(o=>{
    let pickupsText = '', dropoffsText = '';
    try{
      const pickups = typeof o.pickup_locations === 'string' ? JSON.parse(o.pickup_locations) : o.pickup_locations;
      if(Array.isArray(pickups)){
        pickupsText = pickups.map((p,i)=>{
          if(typeof p === 'object' && p.location){
            return `<div style="margin-bottom:6px"><b>${i+1}. ${p.location}</b><br><span style="color:var(--navy)">↳ المطلوب: ${p.goods}</span></div>`;
          } else return `${i+1}. ${p}`;
        }).join('');
      } else pickupsText = pickups;
    }catch{ pickupsText = o.pickup_locations; }
    try{
      const drops = typeof o.dropoff_locations === 'string' ? JSON.parse(o.dropoff_locations) : o.dropoff_locations;
      if(Array.isArray(drops)){
        if(drops.length===1){
          const d = drops[0];
          const loc = typeof d==='object'? d.location : d;
          dropoffsText = `<div><b>${loc}</b><br><small style="color:#16a34a">كل الأغراض</small></div>`;
        } else {
          dropoffsText = drops.map((d,i)=>{
            if(typeof d === 'object' && d.location){
              return `<div style="margin-bottom:6px"><b>${i+1}. ${d.location}</b><br><span style="color:#065F46">↳ نسلم: ${d.goods||'—'}</span></div>`;
            } else return `${i+1}. ${d}`;
          }).join('');
        }
      } else dropoffsText = drops;
    }catch{ dropoffsText = o.dropoff_locations; }

    const date = new Date(o.created_at).toLocaleString('ar-SY');
    return `
    <div class="order-card">
      <div class="top">
        <b>${o.customer_name} - ${o.customer_phone}</b>
        <span class="status ${o.status}">${statusLabel(o.status)}</span>
      </div>
      <div style="font-size:.85rem;color:#555;line-height:1.8">
        <div style="background:#FAFBFF;padding:10px;border-radius:10px;margin-bottom:8px;border:1px solid #E0E7FF">📍 <b>الاستلام:</b><br>${pickupsText}</div>
        <div style="background:#F0FDF4;padding:10px;border-radius:10px;margin-bottom:8px;border:1px solid #BBF7D0">🏁 <b>التسليم:</b><br>${dropoffsText}</div>
        <div>🏷️ ${o.goods_type||''}</div>
        ${o.notes?`<div>📝 ${o.notes}</div>`:''}
        <div>🏠 ${o.customer_address||''}</div>
        <div style="color:#999;font-size:.75rem;margin-top:6px">🕒 ${date} | #${String(o.id).slice(0,8)}</div>
      </div>
      <div class="actions">
        <button class="btn-sm primary" onclick="callCustomer('${o.id}')">📞 اتصال</button>
        <button class="btn-sm" onclick="sendWA('${o.id}')">💬 واتساب</button>
        <button class="btn-sm" onclick="copyMsg('${o.id}')">📋 نسخ</button>
        <select class="btn-sm" onchange="updateStatus('${o.id}',this.value)">
          <option value="">الحالة</option>
          <option value="pending">قيد الانتظار</option>
          <option value="accepted">مقبول</option>
          <option value="in_transit">جاري التوصيل</option>
          <option value="delivered">تم</option>
          <option value="cancelled">ملغي</option>
        </select>
        <button class="btn-sm danger" onclick="deleteOrder('${o.id}')">🗑️</button>
      </div>
    </div>
    `;
  }).join('');
}

function statusLabel(s){
  return {pending:'قيد الانتظار',accepted:'مقبول',in_transit:'جاري التوصيل',delivered:'تم التوصيل',cancelled:'ملغي'}[s]||s;
}

window.copyMsg = async (id)=>{
  const o = allOrders.find(x=>String(x.id)===String(id));
  if(!o) return;
  let pickupStr='', dropStr='';
  try{
    const p = typeof o.pickup_locations === 'string' ? JSON.parse(o.pickup_locations) : o.pickup_locations;
    if(Array.isArray(p)) pickupStr = p.map(x=> typeof x==='object' ? `${x.location} (المطلوب: ${x.goods})` : x).join(' | ');
  }catch{ pickupStr = o.pickup_locations; }
  try{
    const d = typeof o.dropoff_locations === 'string' ? JSON.parse(o.dropoff_locations) : o.dropoff_locations;
    if(Array.isArray(d)) dropStr = d.map(x=> typeof x==='object' ? `${x.location} (${x.goods?`نسلم: ${x.goods}`:'كل الأغراض'})` : x).join(' | ');
  }catch{ dropStr = o.dropoff_locations; }
  const msg = `طلب ألفا من ${o.customer_name} - ${o.customer_phone}\nاستلام: ${pickupStr}\nتسليم: ${dropStr}`;
  await navigator.clipboard.writeText(msg);
  alert('تم النسخ');
};

function normalizeForWhatsApp(phone){
  let p = phone.replace(/\D/g,'');
  if(p.startsWith('00')) p = p.slice(2);
  if(p.startsWith('09') && p.length===10) return '963' + p.slice(1);
  if(p.startsWith('9') && p.length===9) return '963' + p;
  if(p.startsWith('963')) return p;
  if(p.startsWith('0')) p = p.slice(1);
  return p;
}

window.callCustomer = (id)=>{
  const o = allOrders.find(x=>String(x.id)===String(id));
  if(!o) return;
  window.open(`tel:${o.customer_phone}`,'_self');
};

window.sendWA = (id)=>{
  const o = allOrders.find(x=>String(x.id)===String(id));
  if(!o) return;
  const waPhone = normalizeForWhatsApp(o.customer_phone);
  window.open(`https://wa.me/${waPhone}`,'_blank');
};

window.updateStatus = async (id, newStatus)=>{
  if(!newStatus) return;
  const { error } = await supabase.from('orders').update({status:newStatus}).eq('id',id);
  if(error) alert(error.message);
  else loadOrders();
};

window.deleteOrder = async (id)=>{
  if(!confirm('متأكد من الحذف؟')) return;
  const { error } = await supabase.from('orders').delete().eq('id',id);
  if(error) alert(error.message);
  else loadOrders();
};

const searchInput = $('searchInput');
if(searchInput){
  searchInput.addEventListener('input', e=>{
    const q = e.target.value.toLowerCase();
    const filtered = allOrders.filter(o=>
      (o.customer_name||'').toLowerCase().includes(q) ||
      (o.customer_phone||'').includes(q) ||
      (o.goods_type||'').toLowerCase().includes(q)
    );
    renderOrders(filtered);
  });
}

// تشغيل مباشر بدون كلمة سر - الحماية هي اسم الملف المخفي فقط
if(initSupabase()){
  loadOrders();
}
