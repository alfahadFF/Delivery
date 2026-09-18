import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

const supabase = (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) 
  ? createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
  : null;

const $ = (id) => document.getElementById(id);
let pendingPayload = null;
let pendingPickups = [];
let pendingDropoffs = [];

// ========== التحقق من الرقم السوري 10 خانات يبدأ 09 ==========
function isValidSyrianPhone(phone){
  return /^09\d{8}$/.test(phone.replace(/\D/g,''));
}
function getPhoneError(phone){
  const cleaned = phone.replace(/\D/g,'');
  if(!cleaned) return 'الرجاء إدخال رقم الجوال';
  if(cleaned.length < 10) return `الرقم ناقص - يجب 10 أرقام (كتبت ${cleaned.length})`;
  if(cleaned.length > 10) return `الرقم طويل - يجب 10 أرقام فقط`;
  if(!cleaned.startsWith('09')) return 'الرقم يجب أن يبدأ بـ 09';
  return null;
}
function setupPhoneValidation(){
  const phoneInput = $('customerPhone');
  const errorEl = $('phoneError');
  if(!phoneInput) return;
  phoneInput.addEventListener('input', (e)=>{
    let val = e.target.value.replace(/\D/g,'');
    if(val.length > 10) val = val.slice(0,10);
    e.target.value = val;
    const error = getPhoneError(val);
    if(val.length === 0){
      phoneInput.classList.remove('input-error','input-valid');
      errorEl.style.display='none';
      return;
    }
    if(error){
      phoneInput.classList.add('input-error');
      phoneInput.classList.remove('input-valid');
      errorEl.textContent = '❌ ' + error;
      errorEl.style.display='block';
      errorEl.style.background='#fef2f2';
      errorEl.style.borderColor='#fecaca';
      errorEl.style.color='#dc2626';
    } else {
      phoneInput.classList.remove('input-error');
      phoneInput.classList.add('input-valid');
      errorEl.textContent = '✅ رقم صحيح';
      errorEl.style.display='block';
      errorEl.style.background='#f0fdf4';
      errorEl.style.borderColor='#bbf7d0';
      errorEl.style.color='#166534';
      setTimeout(()=>{ if(phoneInput.value.length===10) errorEl.style.display='none'; }, 1200);
    }
  });
}
setupPhoneValidation();

// ========== أماكن الاستلام المرتبطة بالمطلوب ==========
window.addPickup = () => {
  const container = $('pickupContainer');
  const count = container.querySelectorAll('.pickup-group').length + 1;
  const div = document.createElement('div');
  div.className = 'pickup-group';
  div.style.cssText = 'background:#fafbfc;border:1px dashed #e2e8f0;border-radius:12px;padding:10px;margin-bottom:10px;position:relative';
  div.innerHTML = `
    <button type="button" class="btn-remove" style="position:absolute;left:8px;top:8px" onclick="this.parentElement.remove()">✕</button>
    <div class="dynamic-field" style="margin-bottom:8px">
      <input type="text" class="pickup-input" placeholder="مكان الاستلام ${count} - مثال: محل..." required style="padding-left:40px">
    </div>
    <input type="text" class="pickup-goods-input" placeholder="المطلوب من هذا المكان - مثال: 2 كيلو بندورة..." required style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:8px;font-family:'Cairo';font-size:.9rem">
  `;
  container.appendChild(div);
};

window.addDropoff = () => {
  const container = $('dropoffContainer');
  const count = container.querySelectorAll('.dropoff-group').length + 1;
  const div = document.createElement('div');
  div.className = 'dropoff-group';
  div.style.cssText = 'background:#f0fdf4;border:1px dashed #bbf7d0;border-radius:12px;padding:10px;margin-bottom:10px;position:relative';
  div.innerHTML = `
    <button type="button" class="btn-remove" style="position:absolute;left:8px;top:8px" onclick="removeDropoff(this)">✕</button>
    <input type="text" class="dropoff-input" placeholder="مكان التسليم ${count}" required style="width:100%;padding:10px 12px 10px 40px;border:1.5px solid #bbf7d0;border-radius:8px;font-family:'Cairo';font-size:.95rem">
    <input type="text" class="dropoff-goods-input" placeholder="شو نسلم بهالمكان ${count}" required style="width:100%;margin-top:8px;padding:10px 12px;border:1.5px solid #bbf7d0;border-radius:8px;font-family:'Cairo';font-size:.9rem">
  `;
  container.appendChild(div);
  updateDropoffVisibility();
};

window.removeDropoff = (btn) => {
  btn.parentElement.remove();
  updateDropoffVisibility();
};

function updateDropoffVisibility(){
  const container = $('dropoffContainer');
  const allGroups = container.querySelectorAll('.dropoff-group');
  const hint = $('dropoffHint');
  if(allGroups.length <= 1){
    // مكان واحد - أخفِ حقول التوزيع
    allGroups.forEach(g=>{
      const goodsInput = g.querySelector('.dropoff-goods-input');
      if(goodsInput){
        goodsInput.style.display='none';
        goodsInput.required=false;
        goodsInput.value='';
      }
    });
    if(hint){
      hint.textContent = 'إذا مكان واحد، كل الأغراض ستصل له. إذا أكثر من مكان، حدد ماذا يوصل لكل مكان';
      hint.style.color='';
    }
  } else {
    // أكثر من مكان - أظهر حقول التوزيع
    allGroups.forEach(g=>{
      const goodsInput = g.querySelector('.dropoff-goods-input');
      if(goodsInput){
        goodsInput.style.display='block';
        goodsInput.required=true;
      }
    });
    if(hint){
      hint.textContent = '⚠️ حدد ماذا تريد أن نسلم في كل مكان';
      hint.style.color='#d97706';
      hint.style.fontWeight='700';
    }
  }
}

// restore last customer
try{
  const last = JSON.parse(localStorage.getItem('last_customer')||'null');
  if(last){
    $('customerName').value = last.name||'';
    $('customerPhone').value = last.phone||'';
    $('customerAddress').value = last.address||'';
    if(last.phone && isValidSyrianPhone(last.phone)){
      $('customerPhone').classList.add('input-valid');
    }
  }
}catch{}

function collectDropoffs(){
  const groups = document.querySelectorAll('.dropoff-group');
  const result = [];
  groups.forEach(g=>{
    const loc = g.querySelector('.dropoff-input')?.value.trim();
    const goods = g.querySelector('.dropoff-goods-input')?.value.trim();
    if(loc && goods){
      result.push({location: loc, goods: goods});
    } else if(loc){
      result.push({location: loc, goods: ''});
    }
  });
  return result;
}
function collectPickups(){
  const groups = document.querySelectorAll('.pickup-group');
  const result = [];
  groups.forEach(g=>{
    const loc = g.querySelector('.pickup-input')?.value.trim();
    const goods = g.querySelector('.pickup-goods-input')?.value.trim();
    if(loc && goods){
      result.push({location: loc, goods: goods});
    } else if(loc){
      result.push({location: loc, goods: ''});
    }
  });
  return result;
}
function normalizeForWhatsApp(phone){
  let p = phone.replace(/\D/g,'');
  if(p.startsWith('00')) p = p.slice(2);
  if(p.startsWith('09') && p.length===10) return '963' + p.slice(1);
  if(p.startsWith('9') && p.length===9) return '963' + p;
  if(p.startsWith('963')) return p;
  if(p.startsWith('0')) p = p.slice(1);
  return p;
}
function buildWhatsAppMessage(data){
  let msg = `*طلب جديد - ألفا*\n\n`;
  msg += `*👤 العميل:*\n`;
  msg += `الاسم: ${data.customer_name}\n`;
  msg += `الجوال: ${data.customer_phone}\n`;
  if(data.customer_address) msg += `العنوان: ${data.customer_address}\n`;
  msg += `\n*📍 أماكن الاستلام والمطلوب:*\n`;
  data.pickup_locations.forEach((p,i)=>{
    if(typeof p === 'object'){
      msg += `${i+1}- المكان: ${p.location}\n   المطلوب: ${p.goods}\n`;
    } else {
      msg += `${i+1}- ${p}\n`;
    }
  });
  msg += `\n*🏁 التسليم إلى:*\n`;
  if(data.dropoff_locations.length === 1){
    const d = data.dropoff_locations[0];
    const loc = typeof d === 'object' ? d.location : d;
    msg += `${loc}\n`;
    msg += `(كل الأغراض)\n`;
  } else {
    data.dropoff_locations.forEach((d,i)=>{
      if(typeof d === 'object' && d.goods){
        msg += `${i+1}- المكان: ${d.location}\n   نسلم: ${d.goods}\n`;
      } else if(typeof d === 'object'){
        msg += `${i+1}- ${d.location}\n`;
      } else {
        msg += `${i+1}- ${d}\n`;
      }
    });
  }
  if(data.notes) msg += `\n*📝 ملاحظات:*\n${data.notes}\n`;
  msg += `\n_🕒 ${new Date().toLocaleString('ar-SY')} _\n`;
  msg += `_#${data.id?.toString().slice(0,8)||''} | ألفا_`;
  return msg;
}

// ========== معاينة الطلب قبل الإرسال ==========
window.closePreview = () => {
  $('previewModal').classList.remove('active');
};

window.confirmAndSend = async () => {
  const btn = $('confirmSendBtn');
  const errBox = $('errorBox');
  const okBox = $('successBox');
  
  if(!pendingPayload) return;
  
  closePreview();
  const submitBtn = $('submitBtn');
  submitBtn.disabled=true;
  submitBtn.textContent='⏳ جاري الإرسال...';
  btn.disabled=true;
  btn.textContent='⏳...';

  try{
    let saved = {...pendingPayload, id: Math.random().toString(36).slice(2,10)};

    if(supabase){
      const { data, error } = await supabase.from('orders').insert([pendingPayload]).select().single();
      if(error) throw error;
      saved = data;
      if(typeof saved.pickup_locations === 'string'){
        try{ saved.pickup_locations = JSON.parse(saved.pickup_locations); }catch{}
      }
    }

    localStorage.setItem('last_customer', JSON.stringify({
      name: pendingPayload.customer_name,
      phone: pendingPayload.customer_phone,
      address: pendingPayload.customer_address
    }));

    const message = buildWhatsAppMessage(saved);
    if(CONFIG.WHATSAPP_NUMBER){
      const waNumber = normalizeForWhatsApp(CONFIG.WHATSAPP_NUMBER);
      const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
      setTimeout(()=> window.open(url,'_blank'), 700);
    }
    
    okBox.innerHTML = `✅ تم حفظ الطلب<br><small>${pendingPickups.length} أماكن استلام | ${pendingPayload.customer_phone}</small><br>${CONFIG.WHATSAPP_NUMBER ? 'سيتم فتح الواتساب...' : 'تم الحفظ محلياً (ضع رقم الواتساب في config.js)'}`;
    okBox.style.display='block';
    okBox.scrollIntoView({behavior:'smooth'});

    $('notes').value='';
    pendingPayload=null;

  }catch(err){
    console.error(err);
    errBox.textContent = 'حدث خطأ: ' + (err.message||'');
    errBox.style.display='block';
  }finally{
    submitBtn.disabled=false;
    submitBtn.innerHTML='💬 أرسل الطلب واتساب';
    btn.disabled=false;
    btn.textContent='✅ تأكيد وإرسال';
  }
};

function showPreview(payload, pickups, dropoffs){
  pendingPayload = payload;
  pendingPickups = pickups;
  pendingDropoffs = dropoffs;
  
  const content = $('previewContent');
  let html = '';

  html += `<div class="preview-section"><b>👤 بياناتك</b>
    <div class="preview-item">الاسم: ${payload.customer_name}</div>
    <div class="preview-item">الجوال: ${payload.customer_phone} ${isValidSyrianPhone(payload.customer_phone)?'✅':''}</div>
    ${payload.customer_address?`<div class="preview-item">العنوان: ${payload.customer_address}</div>`:''}
  </div>`;

  html += `<div class="preview-section"><b>📍 أماكن الاستلام والمطلوب (${pickups.length})</b>`;
  pickups.forEach((p,i)=>{
    html += `<div class="preview-item"><b>${i+1}. ${p.location}</b><br>↳ المطلوب: ${p.goods}</div>`;
  });
  html += `</div>`;

  if(dropoffs.length === 1){
    html += `<div class="preview-section"><b>🏁 مكان التسليم</b>`;
    html += `<div class="preview-item">${dropoffs[0].location}<br><small style="color:#16a34a">↳ كل الأغراض ستصل لهذا المكان</small></div>`;
    html += `</div>`;
  } else {
    html += `<div class="preview-section"><b>🏁 أماكن التسليم والتوزيع (${dropoffs.length})</b>`;
    dropoffs.forEach((d,i)=>{
      html += `<div class="preview-item"><b>${i+1}. ${d.location}</b><br>↳ نسلم: ${d.goods||'—'}</div>`;
    });
    html += `</div>`;
  }

  if(payload.notes){
    html += `<div class="preview-section"><b>📝 ملاحظات</b><div class="preview-item">${payload.notes}</div></div>`;
  }

  html += `<div style="text-align:center;padding:8px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:.85rem;color:#92400e">⚠️ تأكد من البيانات قبل التأكيد<br>سيتم إرسال الطلب عبر واتساب بعد التأكيد</div>`;

  content.innerHTML = html;
  $('previewModal').classList.add('active');
}

$('deliveryForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const errBox = $('errorBox');
  const okBox = $('successBox');
  const phoneErrorEl = $('phoneError');
  const phoneInput = $('customerPhone');
  
  errBox.style.display='none';
  okBox.style.display='none';

  const rawPhone = phoneInput.value.trim();
  if(!isValidSyrianPhone(rawPhone)){
    const errMsg = getPhoneError(rawPhone) || 'رقم غير صحيح';
    phoneInput.classList.add('input-error');
    phoneErrorEl.textContent = '❌ ' + errMsg + ' - مثال: 09XXXXXXXX (10 أرقام حصرا)';
    phoneErrorEl.style.display='block';
    phoneInput.focus();
    errBox.textContent = '⚠️ ' + errMsg;
    errBox.style.display='block';
    return;
  }

  const pickups = collectPickups();
  const dropoffs = collectDropoffs();

  if(pickups.length===0){
    errBox.textContent='الرجاء إضافة مكان استلام واحد على الأقل مع المطلوب';
    errBox.style.display='block';
    return;
  }
  if(dropoffs.length===0){
    errBox.textContent='الرجاء إضافة مكان تسليم واحد على الأقل';
    errBox.style.display='block';
    return;
  }
  for(let i=0;i<pickups.length;i++){
    if(!pickups[i].location){
      errBox.textContent=`الرجاء كتابة مكان الاستلام ${i+1}`;
      errBox.style.display='block';
      return;
    }
    if(!pickups[i].goods){
      errBox.textContent=`الرجاء كتابة المطلوب من مكان الاستلام ${i+1}`;
      errBox.style.display='block';
      return;
    }
  }
  for(let i=0;i<dropoffs.length;i++){
    if(!dropoffs[i].location){
      errBox.textContent=`الرجاء كتابة مكان التسليم ${i+1}`;
      errBox.style.display='block';
      return;
    }
    // إذا أكثر من مكان تسليم، يجب تحديد ماذا يسلم في كل مكان
    if(dropoffs.length > 1 && !dropoffs[i].goods){
      errBox.textContent=`الرجاء كتابة ماذا تريد أن نسلم في مكان التسليم ${i+1}`;
      errBox.style.display='block';
      return;
    }
  }

  const payload = {
    customer_name: $('customerName').value.trim(),
    customer_phone: rawPhone.replace(/\D/g,''),
    customer_address: $('customerAddress').value.trim(),
    pickup_locations: pickups,
    dropoff_locations: dropoffs,
    goods_type: pickups.map(p=>p.goods).join(' ، '),
    notes: $('notes').value.trim(),
    status: 'pending'
  };

  if(!payload.customer_name){
    errBox.textContent='الرجاء إدخال اسمك';
    errBox.style.display='block';
    return;
  }

  // عرض المعاينة قبل الإرسال
  showPreview(payload, pickups, dropoffs);
});
