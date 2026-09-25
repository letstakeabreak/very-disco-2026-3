import { criteria, reviews } from './review-data';
import './gallery.css';
const container = document.querySelector('#reviews')!;
const className = { '통과':'pass', '미달':'fail', '미검증':'unknown' };
for (const review of reviews) {
  const article = document.createElement('article'); article.id = `target-${review.id}`;
  article.innerHTML = `<div class="target-head"><div><p class="eyebrow">TARGET ${review.id}</p><h2>${review.title}</h2><p class="meta">${review.size} · ${review.mode}</p></div><a class="viewer-link" href="./capture.html?target=${review.id}">실제 WebGL 뷰어 열기 ↗</a></div>
    <p class="summary">${review.summary}</p><label class="view-mode">비교 보기 <select aria-label="${review.id} 비교 보기"><option value="">나란히</option><option value="only-reference">목표만</option><option value="only-actual">실제만</option></select></label>
    <div class="pairs"><figure><img src="../../../art/concepts/${review.concept}" alt="ImageGen 목표 ${review.id}" loading="lazy"><figcaption><span>IMAGEGEN · 목표</span><a href="../../../art/concepts/${review.concept}">원본 열기</a></figcaption></figure><figure><img src="./captures/${review.id}-canonical.png" alt="실제 WebGL ${review.id}" loading="lazy"><figcaption><span>ACTUAL WEBGL · ${review.size}</span><a href="./captures/${review.id}-canonical.png">캡처 열기</a></figcaption></figure></div>
    <div class="table-scroll"><table><thead><tr><th>검토 항목</th><th>판정</th></tr></thead><tbody>${criteria.map((criterion,index)=>`<tr><th>${criterion}</th><td class="${className[review.verdicts[index]!]}">${review.verdicts[index]}</td></tr>`).join('')}</tbody></table></div><ul>${review.notes.map(note=>`<li>${note}</li>`).join('')}</ul>
    ${review.mobile ? `<details><summary>390px / 320px 실제 크기 가독성 캡처</summary><div class="mobile-pairs"><figure style="width:390px"><img src="./captures/${review.id}-390.png" alt="${review.id} 390px"><figcaption>390 × 844 CSS px · DPR1</figcaption></figure><figure class="narrow" style="width:320px"><img src="./captures/${review.id}-320.png" alt="${review.id} 320px"><figcaption>320 × 568 CSS px · DPR1</figcaption></figure></div></details>` : ''}`;
  article.querySelector('select')!.addEventListener('change',(event)=>{ article.querySelector('.pairs')!.className=`pairs ${(event.target as HTMLSelectElement).value}`; });
  container.append(article);
}
