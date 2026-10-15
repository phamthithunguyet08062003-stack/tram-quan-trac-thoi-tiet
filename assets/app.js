const API_URL = 'https://script.google.com/macros/s/AKfycbw0W6ipm6VonK_vnMWNaDLn-lFhjWqDQbYxCmUbhVDmTdC4FkwQPfhwmKQnThXz3V6Xfw/exec';
const metrics = [
 {key:'nhietdo', chart:'temperatureChart',label:'Nhiệt độ',unit:'°C',color:'#ef8c54'},
 {key:'doam',chart:'humidityChart',label:'Độ ẩm',unit:'%',color:'#16a6ce'},
 {key:'tocdogio',chart:'windChart',label:'Tốc độ gió',unit:'m/s',color:'#44b6a5'},
 {key:'luongmua',chart:'rainChart',label:'Lượng mưa',unit:'mm',color:'#688bdb'}
];
const charts = {};
let allData = [], isLoading = false;
const $ = id => document.getElementById(id);
function numeric(value) { return value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value); }
function displayValue(value) { const n = numeric(value); return n === null ? '--' : n.toFixed(1); }
function formatTime(value) { if (!value) return '--'; const date = new Date(value); return isNaN(date.getTime()) ? String(value) : date.toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh'}); }
function setStatus(online,text) { $('statusDot').className = 'status-dot ' + (online ? 'online' : 'error'); $('statusText').textContent = text; }
function showError(text) { $('errorBox').textContent = text; $('errorBox').style.display = text ? 'block' : 'none'; }
function drawCharts(data) {
 if (!$('temperatureChart')) return;
 if (typeof Chart === 'undefined') { $('chartNotice').textContent = 'Không tải được thư viện biểu đồ. Kiểm tra kết nối Internet và tải lại trang.'; return; }
 $('chartNotice').textContent = '';
 Chart.defaults.font.family = 'Weather Sans, Arial, sans-serif';
 const recent = data.slice(-20), labels = recent.map(row => formatTime(row.time));
 metrics.forEach(metric => {
  const values = recent.map(row => numeric(row[metric.key]));
  if(charts[metric.key]) { charts[metric.key].data.labels=labels; charts[metric.key].data.datasets[0].data=values; charts[metric.key].update('none'); return; }
  charts[metric.key]=new Chart($(metric.chart), {type:'line', data:{labels,datasets:[{label:metric.label+' ('+metric.unit+')',data:values,borderColor:metric.color,backgroundColor:metric.color,borderWidth:2,tension:0.3,pointRadius:3}]},options:{responsive:true,maintainAspectRatio:false,animation:false,scales:{x:{ticks:{maxTicksLimit:8,maxRotation:45}},y:{beginAtZero:metric.key!=='nhietdo',title:{display:true,text:metric.unit}}}}});
 });
}
function renderHistory(data) {
 if (!$('historyBody')) return;
 $('recordCount').textContent = data.length+' bản ghi được tải · hiển thị '+Math.min(data.length,200)+' bản ghi gần nhất';
 $('downloadCsv').disabled = !data.length;
 $('historyBody').replaceChildren();
 if (!data.length) { const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=5;td.textContent='Chưa có dữ liệu.';tr.append(td);$('historyBody').append(tr);return; }
 data.slice(-200).reverse().forEach(row=>{const tr=document.createElement('tr');[formatTime(row.time),...metrics.map(m=>displayValue(row[m.key]))].forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});$('historyBody').append(tr);});
}
async function loadData() {
 if (isLoading) return;
 isLoading=true;
 const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),10000);
 try {
  const response=await fetch(API_URL+'?t='+Date.now(), {cache:'no-store',signal:controller.signal});
  if(!response.ok) throw new Error('HTTP '+response.status);
  const result=await response.json();
  if(!result.success || !Array.isArray(result.data)) throw new Error('Dữ liệu API không hợp lệ');
  allData=result.data.filter(row=>row && typeof row==='object');
  const latest=allData[allData.length-1];
  metrics.forEach(m=>{if($(m.key)) $(m.key).textContent=latest ? displayValue(latest[m.key]) : '--';});
  $('lastUpdate').textContent=latest ? formatTime(latest.time) : '--';
  drawCharts(allData);renderHistory(allData);showError('');
  setStatus(Boolean(latest),latest ? 'Đã kết nối — tự động cập nhật mỗi 5 giây' : 'Chưa có dữ liệu');
 } catch(error) {
  setStatus(false,error.name==='AbortError' ? 'Kết nối quá lâu' : 'Không thể kết nối Google Sheets');
  showError('Không lấy được dữ liệu. Kiểm tra Internet, URL Google Apps Script và quyền truy cập Web App.'+(allData.length ? ' Dữ liệu đang hiển thị là dữ liệu tải thành công trước đó.' : ''));
  if($('historyBody') && !allData.length) $('historyBody').textContent='Không tải được lịch sử dữ liệu.';
 } finally { clearTimeout(timeout);isLoading=false; }
}
if($('downloadCsv')) $('downloadCsv').addEventListener('click',()=>{
 const escapeCell=value=>{let s=String(value ?? '');if(/^[=+@-]/.test(s)) s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 const rows=[['Thời gian','Nhiệt độ (°C)','Độ ẩm (%)','Tốc độ gió (m/s)','Lượng mưa (mm)'],...allData.map(row=>[formatTime(row.time),...metrics.map(m=>numeric(row[m.key]) ?? '')])];
 const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(escapeCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='du-lieu-thoi-tiet.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
loadData();setInterval(loadData,5000);
