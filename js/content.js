// 온보딩 슬라이드 + 가이드 (한국어)
export const ONBOARDING = [
  {art:"✈️", title:"서울에서 뉴욕까지, 영어로 가는 여행", body:`<p>I ♥ ENG는 셋이서 매일 영어 쉐도잉을 하고, 그 기록으로 지도 위를 한 칸씩 전진하는 스터디 앱이에요.</p><p>하루 분량을 끝내고 스크립트를 저장하면 그날 완료. 내 말(프로필 사진)이 한 칸 움직여요. 100칸을 가면 뉴욕 도착!</p>`},
  {art:"🎧", title:"쉐도잉은 이렇게", body:`<p><b>하루 1~2분 분량</b>이면 충분해요. 길게 한 번보다 짧게 매일이 훨씬 효과가 커요.</p><ul><li>스크립트를 보며 한 번 듣기 → 뜻 확인</li><li>문장 단위로 끊어서 따라 하기 (연음·강세 흉내)</li><li>스크립트 보면서 전체 따라 하기</li><li>스크립트 없이 따라 하기 (여기까지 오면 완료!)</li></ul><p>자연스럽게 말하는 영상(브이로그, 인터뷰, 시트콤)이 뉴스보다 좋아요.</p>`},
  {art:"📝", title:"매일 할 일", body:`<p>Today 탭에서 <b>Write today's script</b>를 눌러 오늘 본 영상 링크, 시작 시간, 스크립트, 메모를 저장하세요.</p><p>저장했으면 <b>Mark today done</b>을 눌러 도장! 그날 말이 한 칸 전진하고 스트릭이 이어져요.</p><p>새벽 5시 전까지는 "어제"로 쳐요. 자정 넘어 자기 전에 해도 괜찮아요.</p>`},
  {art:"🔁", title:"복습과 녹음", body:`<p>Archive에서 지난 기록을 열면 <b>복습 체크 3칸</b>이 있어요. 며칠 뒤 다시 따라 해보고 하나씩 체크하세요. 같은 걸 3번 복습하면 진짜 내 것이 돼요.</p><p>녹음을 붙여두면 내 발음을 나중에 다시 들을 수 있어요. 녹음은 기본 비공개, 공개를 눌러야 친구에게 보여요. 30일 지나면 자동 삭제돼요 (별표·공개 녹음은 유지).</p>`},
  {art:"🎁", title:"스트릭, 보물상자, 그리고 친구들", body:`<p>연속으로 하면 <b>스트릭</b>이 쌓이고 3·5·7·10·14·21·30일… 마다 <b>보물상자</b>가 열려요. 일주일에 하루는 <b>쉬어가기 카드</b>로 빠져도 스트릭이 유지돼요.</p><p>셋이 같은 날 모두 완료하면 <b>풀하우스</b>! 각자 보너스 반 칸.</p><p>Lounge에서 수다 떨고, 사진 올리고, 스티커 보내고, 밤 9시 넘어도 안 한 친구는 콕 찔러주세요.</p><p>이 가이드는 Me 탭이나 상단 ⓘ에서 언제든 다시 볼 수 있어요.</p>`}
];

export const GUIDE_HTML = `
<h3>1. 이 앱은 뭐예요?</h3>
<p>셋이서 매일 영어 쉐도잉을 하고, 기록으로 서울→뉴욕 지도를 한 칸씩 전진하는 스터디 앱이에요. 하루 분량 완료 = 1칸. 100칸이면 뉴욕 도착.</p>
<h3>2. 매일 하는 것</h3>
<ul>
<li>Today → <b>Write today's script</b>: 영상 링크, 시작 시간(분:초), 스크립트, 메모 저장</li>
<li>쉐도잉 끝났으면 <b>Mark today done</b> → 도장 + 지도 1칸</li>
<li>새벽 5시 전까지는 어제로 쳐요</li>
<li>지난 날짜도 Archive에서 열어 나중에 도장 찍을 수 있어요</li>
</ul>
<h3>3. 쉐도잉 추천 방법</h3>
<ul>
<li>분량: 하루 1~2분. 같은 구간을 최소 3번</li>
<li>영상: 자연스럽게 말하는 것(브이로그·인터뷰·시트콤), 스크립트/자막 있는 것, 70~80% 이해되는 난이도</li>
<li>순서: 듣기+뜻 확인 → 문장 단위 따라 하기 → 스크립트 보며 전체 → 스크립트 없이 전체</li>
<li>메모에 매일 표현 3개와 어려웠던 소리(연음·축약·강세)를 적어두면 복습이 쉬워요</li>
</ul>
<h3>4. 복습</h3>
<p>Archive에서 기록을 열면 복습 체크 3칸이 있어요. 며칠 뒤 다시 따라 해보고 체크. 3칸 다 채운 기록이 쌓이면 뱃지.</p>
<h3>5. 녹음</h3>
<p>기록에 녹음을 붙일 수 있어요(최대 3분). 기본 비공개이고 "Share with friends"를 눌러야 친구가 들을 수 있어요. 30일 지나면 자동 삭제되고, 별표하거나 공개한 녹음은 남아요.</p>
<h3>6. 스트릭 · 쉬어가기 카드 · 보물상자</h3>
<ul>
<li>연속 완료일 = 스트릭. 일주일에 하루는 쉬어가기 카드로 빠져도 유지</li>
<li>3·5·7·10·14·21·30·45·60·90·100일에 보물상자. 한 번 열면 끊겨도 남아요</li>
<li>지도 위치는 총 완료일수 기준이라 끊겨도 뒤로 안 가요</li>
</ul>
<h3>7. 친구들과</h3>
<ul>
<li>Today 상단에 친구들 오늘 완료 여부. 밤 9시 넘어도 안 한 친구는 <b>poke</b>로 콕</li>
<li>셋이 같은 날 모두 완료 = 풀하우스 → 각자 보너스 반 칸</li>
<li>Lounge: 채팅·사진·스티커. 완료·도시 도착·상자 열림은 자동으로 올라와요</li>
<li>일요일 밤 주간 결산 카드가 라운지에 올라와요</li>
</ul>
<h3>8. 폰에 설치하기</h3>
<p>아이폰: 사파리에서 열고 공유 → 홈 화면에 추가. 안드로이드: 크롬 메뉴 → 홈 화면에 추가. 한 번 로그인하면 다음부턴 바로 열려요.</p>
`;

export const LANDMARKS = [
  {at:15, name:"Incheon Airport", ko:"인천공항", art:"🛫", msg:"출발! 인천공항에서 탑승 완료."},
  {at:30, name:"Guam", ko:"괌", art:"🏝️", msg:"괌 도착. 한 달 버텼다는 뜻이에요."},
  {at:45, name:"Mid-Pacific", ko:"태평양 한가운데 · 기내식", art:"🍱", msg:"태평양 한가운데. 기내식 먹고 갑시다."},
  {at:60, name:"Hawaii", ko:"하와이", art:"🌺", msg:"알로하, 하와이! 두 달 완주."},
  {at:70, name:"LA · In-N-Out", ko:"LA 인앤아웃", art:"🍔", msg:"본토 상륙. LA에서 인앤아웃 한 입."},
  {at:80, name:"Texas BBQ", ko:"텍사스 BBQ", art:"🍖", msg:"텍사스 브리스킷. 이제 동부가 코앞."},
  {at:100, name:"New York", ko:"뉴욕", art:"🗽", msg:"뉴욕 도착!!! 100일을 해냈어요. I ♥ ENG."}
];

export const MILESTONES = [3,5,7,10,14,21,30,45,60,90,100];
export const REWARDS = {
  3:["작심삼일 돌파!","Three days in a row. The hardest part is behind you.","🎀 ribbon frame for your token"],
  5:["High five","Five days. Your mouth is starting to remember the shapes.","✨ sparkle sticker set"],
  7:["One full week","Seven days of shadowing. That's a real habit now.","👑 crown for your token"],
  10:["Double digits","Ten days. Your ear is catching things it used to miss.","🧁 sweets sticker set"],
  14:["Two weeks strong","Fourteen days. Linking and rhythm are getting natural.","🌈 rainbow frame"],
  21:["Habit formed","Twenty-one days — the classic habit line. You crossed it.","🐣 chick sticker set"],
  30:["One month","Thirty days. Go back and listen to day one. Hear the difference?","🪩 disco frame"],
  45:["Unstoppable","Forty-five days. This is who you are now.","🎸 band sticker set"],
  60:["Two months","Sixty days. Your intonation belongs to you.","💎 diamond frame"],
  90:["A full season","Ninety days. Fluency is built exactly like this.","🚀 rocket sticker set"],
  100:["One hundred days","A hundred days of showing up. Take a bow.","🗽 Liberty frame"]
};
export const STICKERS = ["💖","👏","🔥","🌟","🍓","🍰","🐥","🫶","😭","😤","🥹","💤","☕","🎧","✈️","🗽","🍔","🌺"];
