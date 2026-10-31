/* Direct PDF download: Safari cannot append the admin page URL to this document. */
async function downloadPartnerStatementPdf() {
  const partner=selectedPartner();if(!partner)return;
  if(!window.PDFLib?.PDFDocument)return alert("PDF library is still loading. Please try again in a moment.");
  const month=astate.partnerMonth,monthLabel=partnerStatementMonthLabel(month),orders=partnerOrderRows(partner.id,month),metrics=partnerMetrics(partner,month),payout=partnerPayoutStatus(partner,month);
  const width=595,height=842,margin=42,bodyWidth=width-margin*2,pages=[];
  let ctx,y;
  const font=(size=10,bold=false)=>`${bold?"700":"400"} ${size}px -apple-system, BlinkMacSystemFont, Arial, sans-serif`;
  function newPage(){
    const canvas=document.createElement("canvas");canvas.width=width*2;canvas.height=height*2;
    ctx=canvas.getContext("2d");ctx.scale(2,2);ctx.fillStyle="#fff";ctx.fillRect(0,0,width,height);
    pages.push({canvas,ctx});y=margin;
    ctx.fillStyle="#4b5d3a";ctx.font=font(10,true);ctx.fillText("SHIZUKU LAB  ×  "+String(partner.name||"Partner"),margin,y);y+=24;
    ctx.fillStyle="#292a24";ctx.font="700 23px Georgia, serif";ctx.fillText("Partner Referral Statement",margin,y);y+=23;
    ctx.fillStyle="#746f65";ctx.font=font(10);ctx.fillText(monthLabel+"  ·  Generated "+new Date().toLocaleString("en-SG"),margin,y);y+=24;
    ctx.strokeStyle="#ded8cd";ctx.beginPath();ctx.moveTo(margin,y);ctx.lineTo(width-margin,y);ctx.stroke();y+=20;
  }
  function fit(text,maxWidth,size=10,bold=false){
    ctx.font=font(size,bold);const words=String(text??"—").split(/\s+/),lines=[];let current="";
    for(const word of words){const next=current?current+" "+word:word;if(ctx.measureText(next).width>maxWidth&&current){lines.push(current);current=word;}else current=next;}
    if(current)lines.push(current);return lines.length?lines:["—"];
  }
  function ensure(space){if(y+space>height-55)newPage();}
  function line(text,size=10,bold=false,color="#292a24",indent=0,maxWidth=bodyWidth){
    const parts=fit(text,maxWidth,size,bold);ensure(parts.length*(size+5));ctx.font=font(size,bold);ctx.fillStyle=color;
    for(const part of parts){ctx.fillText(part,margin+indent,y);y+=size+5;}
  }
  newPage();
  const summary=[
    ["All orders",metrics.referralOrders],["Completed",metrics.completedOrders],
    ["Eligible sales",money(metrics.eligibleSales)],["Member savings",money(metrics.memberDiscount)],
    ["Commission earned",money(metrics.commission)],["Commission paid",money(metrics.paid)],
    ["Outstanding",money(metrics.outstanding)],["Payout status",payout]
  ];
  for(let i=0;i<summary.length;i+=2){
    ensure(52);const top=y;
    for(let col=0;col<2;col++){
      const value=summary[i+col];if(!value)continue;const x=margin+col*(bodyWidth/2+5),boxWidth=bodyWidth/2-5;
      ctx.strokeStyle="#ddd6c9";ctx.strokeRect(x,top,boxWidth,46);
      ctx.fillStyle="#746f65";ctx.font=font(9);ctx.fillText(String(value[0]),x+11,top+16);
      ctx.fillStyle="#292a24";ctx.font=font(15,true);ctx.fillText(String(value[1]),x+11,top+36);
    }
    y+=55;
  }
  y+=8;line("Every Partner order is listed, including pending and cancelled orders. Only collected/completed eligible orders earn commission.",9,false,"#746f65");y+=13;
  line("Order history",15,true);y+=4;
  if(!orders.length)line("No Partner orders were placed in this month.",10,false,"#746f65");
  for(const order of orders){
    const financial=partnerFinancialRecord(order.id),commission=partnerCommissionState(order,financial);
    const rows=[
      `${order.order_number||order.id}  ·  ${partnerOrderPlacedDate(order)}  ·  ${partnerOrderState(order)}`,
      `${order.customer_name||"Customer"}${order.customer_phone?"  ·  "+order.customer_phone:""}`,
      partnerOrderItemsText(order),
      `Collection: ${partnerOrderPickup(order)}  ·  Payment: ${PAY_LABEL[order.payment_status]||order.payment_status||"—"}`,
      `Member saving ${money(order.partner_discount_amount||0)}  ·  Total ${money(order.total||0)}  ·  Commission ${commission.amount||"—"}`
    ];
    ctx.font=font(9);const heightNeeded=rows.reduce((sum,row)=>sum+fit(row,bodyWidth-22,9).length*13,0)+20;
    ensure(heightNeeded);ctx.fillStyle="#f8f6f0";ctx.fillRect(margin,y-13,bodyWidth,heightNeeded-3);
    y+=3;for(let i=0;i<rows.length;i++)line(rows[i],i===0?10:9,i===0,i===0?"#292a24":"#55574e",10,bodyWidth-20);y+=12;
  }
  pages.forEach((page,index)=>{
    const c=page.ctx;c.strokeStyle="#ded8cd";c.beginPath();c.moveTo(margin,height-39);c.lineTo(width-margin,height-39);c.stroke();
    c.font=font(8);c.fillStyle="#777268";c.fillText(`Shizuku Lab × ${partner.name} · Powered by OneTouch Studio`,margin,height-26);
    c.fillText(`${index+1} / ${pages.length}`,width-margin-26,height-26);
  });
  try{
    const documentPdf=await window.PDFLib.PDFDocument.create();
    for(const page of pages){const image=await documentPdf.embedPng(page.canvas.toDataURL("image/png"));documentPdf.addPage([width,height]).drawImage(image,{x:0,y:0,width,height});}
    const bytes=await documentPdf.save(),blob=new Blob([bytes],{type:"application/pdf"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`${String(partner.slug||"partner").replace(/[^a-z0-9-]/gi,"-")}-${month}-statement.pdf`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){alert("Could not generate statement PDF: "+(error?.message||error));}
}

// Keep the existing admin button working until its label is updated in a later release.
window.openPartnerStatementPdf = downloadPartnerStatementPdf;
