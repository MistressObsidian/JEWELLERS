const brands=['DOVES','CRISSCUT','SWAROVSKI','DIAMOND DAYS'];let brandOffset=0;function renderBrands(){document.querySelectorAll('.brandName').forEach((el,i)=>el.textContent=brands[(i+brandOffset)%brands.length])}document.querySelector('#brandPrev').addEventListener('click',()=>{brandOffset=(brandOffset+brands.length-1)%brands.length;renderBrands()});document.querySelector('#brandNext').addEventListener('click',()=>{brandOffset=(brandOffset+1)%brands.length;renderBrands()});
    document.querySelectorAll('.arrivalCard').forEach(card=>{
  const slides=[...card.querySelectorAll('.arrivalSlide')];
  const dots=[...card.querySelectorAll('.arrivalDot')];
  const count=card.querySelector('.arrivalCount');
  let index=0;
  function render(){
    slides.forEach((slide,i)=>slide.classList.toggle('active',i===index));
    dots.forEach((dot,i)=>dot.classList.toggle('active',i===index));
    count.textContent=`${String(index+1).padStart(2,"0")} / 04`;
  }
  card.querySelector('.arrivalPrev').addEventListener('click',()=>{
    index=(index+slides.length-1)%slides.length;
    render();
  });
  card.querySelector('.arrivalNext').addEventListener('click',()=>{
    index=(index+1)%slides.length;
    render();
  });
  dots.forEach((dot,i)=>dot.addEventListener('click',()=>{
    index=i;
    render();
  }));
  render();
});
document.querySelector('#subscribeForm').addEventListener('submit',e=>{e.preventDefault();e.currentTarget.hidden=true;document.querySelector('#formSuccess').hidden=false});
