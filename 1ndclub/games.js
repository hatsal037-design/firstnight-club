/* 첫밤 사망자 클럽 게임 도감 — 데이터
   여기만 고치면 앱이 갱신된다. 새 게임은 GAMES 배열에 한 줄 추가.

   필드
     n   이름
     min/max  인원 (max: null 이면 사실상 상한 없음)
     t   플레이 시간(분)
     cat 카테고리 — mafia | party | strategy | coop | quick
     lv  난이도 — 초보 | 중급 | 고급
     out 탈락자가 생기는가 (true = 죽으면 관전)
     host 진행자가 필요한가
     own 소유자 — 임햇살 | 채연주 | '' (미확인)
     d   한 줄 설명
     r   룰 요약 (2~3줄)
     have 보유 여부. false 면 위시리스트(구매 후보)
     img  카드에 쓸 사진 경로 (없으면 이름으로 만든 커버가 뜬다) — img/README.md 참고
     bl   보드라이프 데이터 {rate 평점, weight 난이도(1~5), rank 종합순위, players, minutes, age, url, bgg}
          — 수집 2026-08-11, 재수집은 클럽폴더 data_boardlife.json 참고
     rules 룰 상세. 없으면 앱에서 '아직 정리 전'으로 뜬다. 블록을 순서대로 쌓는다.
           { h:'소제목' }              소제목만
           { h:'소제목', p:'설명' }     소제목 + 문단
           { p:'설명' }                문단만
           { img:'img/rules/xx.jpg', cap:'사진 설명' }   사진 (cap 은 생략 가능)
           { list:['한 줄','두 줄'] }   번호 매긴 목록
*/

const GAMES = [
  // ── 마피아류 ──────────────────────────────
  { n:'오리지널 마피아', img:'img/t/mafia.jpg', min:6, max:16, t:30, cat:'mafia', lv:'초보', out:true, host:true, own:'임햇살', have:true,
    d:'모든 것의 시작. 밤에 죽이고 낮에 지목한다.',
    r:'밤에 마피아가 한 명을 지목해 죽이고, 낮에 전원이 토론해 한 명을 처형한다. 마피아를 전부 찾으면 시민 승리.',
    rules:[
      { h:'인원 구성', p:'8명이면 마피아 2 · 의사 1 · 경찰 1 · 시민 4가 기본입니다. 인원이 늘면 마피아를 한 명씩 더합니다. 진행자는 게임에 참여하지 않고 밤을 이끕니다.' },
      { h:'밤에 하는 일', list:[
        '진행자가 "모두 눈을 감으세요"라고 말합니다.',
        '마피아끼리 눈을 떠 서로를 확인하고, 죽일 사람 한 명을 손짓으로 정합니다.',
        '경찰이 눈을 떠 한 명을 지목하면 진행자가 마피아인지 아닌지 알려줍니다.',
        '의사가 눈을 떠 살릴 사람 한 명을 지목합니다. 마피아가 노린 사람과 같으면 살아납니다.',
      ]},
      { h:'낮에 하는 일', p:'진행자가 밤새 누가 죽었는지 발표합니다. 그다음 모두 토론해 의심스러운 한 명을 투표로 처형합니다. 처형된 사람의 정체는 공개합니다.' },
      { h:'이기는 조건', p:'마피아를 전부 처형하면 시민 승리. 마피아 수가 시민 수와 같아지면 마피아 승리입니다.' },
      { h:'우리 모임에서는', p:'첫 밤에 죽어도 끝까지 자리에 남아 구경합니다. 판이 끝나면 다 같이 복기하니까 그때 이야기를 나눠주세요. 판이 도는 중에 훈수는 금지입니다.' },
    ] },
  { n:'시크릿 히틀러', bl:{"rate": 7.5, "weight": 1.74, "rank": 268, "players": "5-10", "minutes": "45", "age": 13, "url": "https://boardlife.co.kr/game/6131"}, img:'img/t/secret-hitler.jpg', min:5, max:10, t:45, cat:'mafia', lv:'중급', out:false, host:false, own:'임햇살', have:true,
    d:'아무도 죽지 않는 마피아. 법안을 통과시키며 정체를 읽는다.',
    r:'대통령과 총리가 법안 카드를 골라 통과시킨다. 자유당은 자유 법안 5장, 파시스트는 파시스트 법안 6장 또는 히틀러를 총리로 만들면 승리.',
    rules:[
      { h:'무엇이 다른가', p:'죽어서 빠지는 사람이 없습니다. 처음부터 끝까지 전원이 발언하고 투표합니다. 첫 밤에 죽는 일이 아예 없어서 이 모임에 잘 맞아요.' },
      { h:'한 판의 흐름', list:[
        '대통령이 순서대로 돌아갑니다. 대통령이 총리 후보를 지명합니다.',
        '전원이 찬반 투표를 합니다. 과반이 찬성해야 정부가 성립합니다.',
        '대통령이 법안 카드 3장을 받아 1장을 버리고 2장을 총리에게 넘깁니다.',
        '총리가 그중 1장을 버리고 남은 1장을 공개해 통과시킵니다.',
      ]},
      { h:'핵심', p:'카드를 주고받는 과정이 비공개라 서로 거짓말을 할 수 있습니다. "나는 자유 법안 두 장을 넘겼는데 총리가 파시스트를 냈다" 같은 공방이 이 게임의 전부입니다.' },
      { h:'이기는 조건', p:'자유당은 자유 법안 5장을 통과시키면 승리. 파시스트는 파시스트 법안 6장을 통과시키거나, 파시스트 법안이 3장 깔린 뒤 히틀러를 총리로 앉히면 승리합니다.' },
    ] },
  { n:'아발론', bl:{"rate": 7.836, "weight": 1.74, "rank": 79, "players": "5-10", "minutes": "30", "age": 13, "url": "https://boardlife.co.kr/game/523", "bgg": "https://boardgamegeek.com/boardgame/128882/the-resistance-avalon"}, img:'img/t/avalon.jpg', min:5, max:10, t:30, cat:'mafia', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'원탁의 기사 안에 숨은 모드레드의 하수인을 찾아라.',
    r:'원정대를 꾸려 임무를 보낸다. 선이 3번 성공하면 승리, 악이 3번 방해하면 패배. 멀린은 악을 알지만 들키면 안 된다.' },
  { n:'스파이폴2', bl:{"rate": 6.5, "weight": 1.22, "rank": 1666, "players": "3-12", "minutes": "15", "age": 13, "url": "https://boardlife.co.kr/game/8159", "bgg": "https://boardgamegeek.com/boardgame/193308/spyfall-2"}, img:'img/t/spyfall2.jpg', min:3, max:12, t:20, cat:'mafia', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'나만 장소를 모른다. 아는 척하며 질문을 넘긴다.',
    r:'한 명만 장소 카드를 못 받는다. 서로 질문을 주고받으며 스파이를 찾고, 스파이는 장소를 알아맞히면 승리. 12명까지 한 판.',
    rules:[
      { h:'준비', p:'장소 카드를 한 장 뽑아 모두에게 같은 장소를 나눠주는데, 딱 한 명에게만 스파이 카드가 갑니다. 스파이는 오늘 장소가 어디인지 모릅니다.' },
      { h:'진행', p:'아무나 한 명을 골라 장소에 관한 질문을 던집니다. 대답한 사람이 다시 다른 사람에게 질문합니다. 8분 동안 이어집니다.' },
      { h:'질문의 요령', p:'너무 구체적이면 스파이에게 장소를 알려주는 꼴이고, 너무 두루뭉술하면 스파이인지 아닌지 구분이 안 됩니다. 그 사이를 노리는 게 재미입니다.' },
      { h:'이기는 조건', p:'시간이 끝나면 투표로 스파이를 지목합니다. 맞히면 시민 승리. 스파이는 정체가 들키기 전에 장소를 맞히면 승리합니다.' },
      { h:'우리 모임에서는', p:'20분이면 한 판이라 몸풀기로 자주 씁니다. 늦게 오신 분이 있어도 다음 판에 바로 합류할 수 있어요.' },
    ] },
  { n:'사보타지', bl:{"rate": 6.9, "weight": 1.32, "rank": 935, "players": "3-10", "minutes": "30", "age": 8, "url": "https://boardlife.co.kr/game/1270"}, img:'img/t/saboteur.jpg', min:3, max:10, t:30, cat:'mafia', lv:'초보', out:false, host:false, own:'', have:true,
    d:'금을 캐는 광부 사이에 길을 막는 방해꾼이 섞여 있다.',
    r:'터널 카드를 이어 금까지 길을 낸다. 광부는 도착하면 승리, 방해꾼은 막으면 승리. 서로 정체를 모른 채 진행.' },
  { n:'한밤의 늑대인간', bl:{"rate": 7.4, "weight": 1.38, "rank": 328, "players": "3-10", "minutes": "10", "age": 8, "url": "https://boardlife.co.kr/game/2500", "bgg": "https://boardgamegeek.com/boardgame/147949/one-night-ultimate-werewolf"}, img:'img/t/onuw.jpg', min:3, max:10, t:10, cat:'mafia', lv:'초보', out:false, host:false, own:'임햇살', have:true,
    d:'단 한 번의 밤, 단 한 번의 투표. 10분 만에 끝나는 늑대인간.',
    r:'전원 역할을 받고 한 번의 밤에 역할별 행동을 한다. 밤사이 역할이 바뀌었을 수도 있다. 낮 토론 한 번, 동시 지목 한 번으로 끝. 늑대를 잡으면 마을 승리.',
    rules:[
      { h:'준비', p:'인원+3장의 역할 카드를 섞어 한 장씩 받고, 남은 3장은 가운데에 엎어둡니다. 앱이나 진행자가 밤 순서를 불러줍니다.' },
      { h:'밤에 하는 일', list:[
        '늑대인간끼리 눈을 떠 서로를 확인합니다. 늑대가 혼자면 가운데 카드 한 장을 볼 수 있습니다.',
        '예언자는 다른 사람 카드 한 장 또는 가운데 카드 두 장을 봅니다.',
        '강도는 다른 사람과 카드를 바꾸고 새 카드를 확인합니다.',
        '말썽꾸러기는 다른 두 사람의 카드를 서로 바꿉니다(보지 않고).',
      ]},
      { h:'낮과 투표', p:'모두 눈을 뜨고 토론합니다. 내 역할이 밤사이 바뀌었을 수 있다는 게 핵심. 시간이 되면 셋을 세고 동시에 한 명을 지목합니다. 최다 득표자가 처형됩니다.' },
      { h:'이기는 조건', p:'늑대인간이 한 명이라도 처형되면 마을 승리. 늑대가 아무도 안 죽으면 늑대 승리. 무두장이는 자기가 죽어야 승리합니다.' },
      { h:'우리 모임에서는', p:'탈락이 없고 10분이면 끝나서 몇 판이고 돌립니다. 공식 앱 나레이션으로 진행자 없이 진행해요.' },
    ] },
  { n:'한밤의 늑대인간2 황혼에서새벽까지', bl:{"rate": 7.1, "weight": 1.44, "players": "3-7", "minutes": "10", "age": 8, "url": "https://boardlife.co.kr/game/4549", "bgg": "https://boardgamegeek.com/boardgame/157703/one-night-ultimate-werewolf-daybreak"}, img:'img/t/onuw2.jpg', min:3, max:7, t:10, cat:'mafia', lv:'중급', out:false, host:false, own:'임햇살', have:true,
    d:'늑대인간 2탄. 새 역할 11종, 1탄과 섞으면 판이 커진다.',
    r:'기본 진행은 1탄과 같고 역할이 전부 새것. 단독으로 3~7인, 1탄과 합치면 10인 이상도 가능하다.',
    rules:[
      { h:'1탄과 다른 점', p:'꿈꾸는 늑대·미치광이·주정뱅이 심화판 같은 새 역할 11종이 들어 있습니다. 역할 간 상호작용이 복잡해져서 1탄을 몇 판 해본 뒤에 섞는 걸 추천합니다.' },
      { h:'섞어서 크게', p:'1탄 카드와 합치면 대인원 판이 됩니다. 앱 나레이션이 두 세트 역할을 모두 지원합니다.' },
      { h:'우리 모임에서는', p:'1탄으로 몸을 풀고, 익숙해진 테이블에 2탄 역할을 한두 장씩 끼워 넣는 방식으로 돌립니다.' },
    ] },

  // ── 파티 ──────────────────────────────────
  { n:'장난꾸러기 호박벌', bl:{"rate": 6.6, "weight": 1.26, "players": "3-5", "minutes": "20-25", "age": 7, "url": "https://boardlife.co.kr/game/9583", "bgg": "https://boardgamegeek.com/boardgame/300956/cheating-bumblebee"}, img:'img/t/schummel-hummel.jpg', min:3, max:5, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'반칙이 공식적으로 허용되는 카드 게임. 몰래 버리고 시치미 떼기.',
    r:'손의 카드를 먼저 다 버리면 승리. 규칙대로만 내면 느리니까 카드를 몰래 숨기고 떨어뜨려도 된다 — 단, 호박벌 감시자에게 걸리면 벌칙. 걸리느냐 못 본 척하느냐의 눈치 싸움.' },
  { n:'힛스터', bl:{"rate": 7.3, "weight": 1.01, "rank": 397, "players": "2-10", "minutes": "30", "age": 16, "url": "https://boardlife.co.kr/game/16056", "bgg": "https://boardgamegeek.com/boardgame/318243/hitster"}, img:'img/t/hitster.jpg', min:2, max:null, t:30, cat:'party', lv:'초보', out:false, host:false, own:'임햇살', have:true,
    d:'노래 듣고 연도 맞히기. 팀으로 나누면 인원 제한이 없다.',
    r:'QR을 찍어 노래를 틀고 발매 연도를 추측해 내 연표 사이에 끼워넣는다. 맞으면 카드 획득, 10장 모으면 승리.' },
  { n:'달무티', bl:{"rate": 7.4, "weight": 1.29, "rank": 300, "players": "4-8", "minutes": "60", "age": 8, "url": "https://boardlife.co.kr/game/968", "bgg": "https://boardgamegeek.com/boardgame/929/the-great-dalmuti"}, img:'img/t/dalmuti.jpg', min:4, max:8, t:15, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'신분 계급이 매 판 뒤집힌다. 왕이 거지가 되는 맛.',
    r:'낮은 숫자가 강하다. 카드를 먼저 다 버린 순서대로 다음 판의 계급이 정해지고, 계급에 따라 카드를 상납한다.' },
  { n:'플립7', bl:{"rate": 7.4, "weight": 1.04, "rank": 327, "players": "3-99", "minutes": "20", "age": 8, "url": "https://boardlife.co.kr/game/19910", "bgg": "https://boardgamegeek.com/boardgame/420087/flip-7"}, img:'img/t/flip7.jpg', min:3, max:18, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'한 장 더? 여기서 멈춤? 18명까지 되는 심플 도박.',
    r:'카드를 계속 뽑아 점수를 쌓되 같은 숫자가 겹치면 그 판 점수는 0. 서로 다른 숫자 7장을 모으면 보너스.' },
  { n:'애니멀렐름', bl:{"rate": 6.4, "weight": 1.5, "rank": 1821, "players": "3-7", "minutes": "5-20", "age": 8, "url": "https://boardlife.co.kr/game/11812", "bgg": "https://boardgamegeek.com/boardgame/307995/animal-realms"}, img:'img/t/animal-realms.jpg', min:3, max:7, t:15, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'동물 카드로 벌이는 짧은 세력 다툼.',
    r:'같은 동물을 모으거나 상대를 밀어내며 영역을 차지한다. 한 판이 짧아 여러 번 돌린다.' },
  { n:'바퀴벌레포커', bl:{"rate": 6.6, "weight": 1.1, "rank": 1420, "players": "2-6", "minutes": "20", "age": 8, "url": "https://boardlife.co.kr/game/215"}, img:'img/t/cockroach-poker.jpg', min:3, max:5, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'거짓말 하나로 굴러가는 게임. 마피아 몸풀기에 좋다.',
    r:'카드를 뒤집어 내밀며 "이건 바퀴벌레"라고 말한다. 받는 사람은 진실인지 거짓인지 판정하고, 틀린 쪽이 카드를 가져간다. 같은 벌레 4장을 모으면 패배.' },
  { n:'조겐 (Zogen)', bl:{"rate": 6.0, "weight": 1.67, "rank": 6468, "players": "2-6", "minutes": "20", "age": 6, "url": "https://boardlife.co.kr/game/9703", "bgg": "https://boardgamegeek.com/boardgame/249289/zogen"}, img:'img/t/zogen.jpg', min:2, max:6, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'가볍게 굴러가는 카드 게임.',
    r:'카드를 내며 조건을 맞춘다. 룰이 짧아 설명 시간이 거의 안 든다.' },
  { n:'케자오 (Kezao)', bl:{"rate": 6.1, "weight": 1.0, "rank": 2455, "players": "2-5", "minutes": "20-30", "age": 6, "url": "https://boardlife.co.kr/game/16280", "bgg": "https://boardgamegeek.com/boardgame/340744/kezao"}, img:'img/t/kezao.jpg', min:2, max:5, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'짧고 가벼운 카드 게임.',
    r:'조건에 맞는 카드를 빠르게 내며 손패를 턴다.' },
  { n:'파티사우루스20s', bl:{"rate": 6.0, "weight": 1.33, "rank": 6300, "players": "3-5", "minutes": "20-30", "age": 8, "url": "https://boardlife.co.kr/game/20162", "bgg": "https://boardgamegeek.com/boardgame/427278/roaring-20s"}, img:'img/t/partysaurus.jpg', min:3, max:5, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'공룡 테마 파티게임.',
    r:'짧은 라운드를 반복하며 점수를 쌓는다. 분위기 띄우는 용도.' },
  { n:'5타워', img:'img/t/5towers.jpg', min:2, max:5, t:20, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'다섯 개의 탑에 카드를 쌓는 눈치 게임.',
    r:'숫자 카드를 동시에 공개해 낮은 순서대로 탑에 놓는다. 여섯 번째가 되면 그 탑을 통째로 가져간다. 적게 가져간 쪽이 승리.' },
  { n:'굿페이스밷페이스', img:'img/t/goodface.jpg', min:2, max:5, t:15, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'표정으로 굴러가는 짧은 파티게임.',
    r:'라운드마다 조건에 맞는 카드를 고른다. 룰이 단순해 첫 게임으로 쓰기 좋다.' },
  { n:'워드캡처', bl:{"rate": 7.1, "weight": 1.13, "rank": 646, "players": "2-5", "minutes": "10", "age": 6, "url": "https://boardlife.co.kr/game/12896", "bgg": "https://boardgamegeek.com/boardgame/322204/word-capture"}, img:'img/t/word-capture.jpg', min:2, max:6, t:10, cat:'party', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'10분짜리 단어 게임. 대기 시간 메우기에 최적.',
    r:'제시된 조건에 맞는 단어를 먼저 잡는다. 순발력과 어휘력 싸움.' },

  // ── 순발력 ────────────────────────────────
  { n:'타코캣고트치즈피자', bl:{"rate": 6.8, "weight": 1.04, "rank": 1108, "players": "2-8", "minutes": "10-30", "age": 8, "url": "https://boardlife.co.kr/game/12352"}, img:'img/t/tacocat.jpg', min:3, max:8, t:10, cat:'quick', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'10분. 시끄럽고, 아무도 지루할 틈이 없다.',
    r:'"타코-캣-고트-치즈-피자"를 순서대로 외치며 카드를 낸다. 말과 카드가 일치하면 손을 올린다. 가장 늦은 사람이 카드 더미를 가져간다.' },
  { n:'할리갈리', bl:{"rate": 6.2, "weight": 1.02, "rank": 2267, "players": "2-6", "minutes": "10", "age": 6, "url": "https://boardlife.co.kr/game/2145"}, img:'img/t/halli-galli.jpg', min:2, max:6, t:15, cat:'quick', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'설명이 필요 없는 국민 게임.',
    r:'같은 과일이 정확히 5개가 되면 종을 친다. 먼저 친 사람이 카드를 가져간다.' },
  { n:'고스트블리츠', img:'img/t/ghost-blitz.jpg', min:2, max:8, t:20, cat:'quick', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'색과 모양이 헷갈리게 만드는 반사신경 게임.',
    r:'카드에 그려진 물건 중 색과 모양이 모두 일치하지 않는 것을 먼저 집는다. 뇌가 꼬이는 게 재미.' },
  { n:'서펜티나', bl:{"rate": 5.7, "weight": 1.02, "rank": 3192, "players": "2-5", "minutes": "15", "age": 4, "url": "https://boardlife.co.kr/game/3046"}, img:'img/t/serpentina.jpg', min:2, max:5, t:15, cat:'quick', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'뱀을 이어붙이는 짧은 게임. 아이도 어른도 된다.',
    r:'카드를 뒤집어 색이 맞는 뱀을 이어붙인다. 머리와 꼬리를 완성하면 그 뱀을 가져간다.' },
  { n:'아브라카왓', bl:{"rate": 7.0, "weight": 1.64, "rank": 721, "players": "2-5", "minutes": "30", "age": 7, "url": "https://boardlife.co.kr/game/4331"}, img:'img/t/abracawhat.jpg', min:2, max:5, t:30, cat:'quick', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'주문을 외우며 물건을 집는 마법 테마 순발력 게임.',
    r:'조건에 맞는 물건을 먼저 집는다. 라운드마다 조건이 바뀌어 헷갈린다.' },

  // ── 전략 ──────────────────────────────────
  { n:'클루', bl:{"rate": 6.2, "weight": 1.64, "rank": 2215, "players": "2-6", "minutes": "40", "age": 8, "url": "https://boardlife.co.kr/game/8752", "bgg": "https://boardgamegeek.com/boardgame/130592/clue"}, img:'img/t/clue.jpg', min:2, max:6, t:20, cat:'strategy', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'누가, 어디서, 무엇으로. 추리 게임의 고전.',
    r:'질문과 소거로 범인·장소·흉기를 좁혀간다. 먼저 정확히 맞히면 승리.' },
  { n:'코드777', bl:{"rate": 6.7, "weight": 2.32, "rank": 1223, "players": "2-5", "minutes": "60", "age": 10, "url": "https://boardlife.co.kr/game/409"}, img:'img/t/code777.jpg', min:2, max:5, t:40, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'남의 숫자는 보이는데 내 숫자만 안 보인다.',
    r:'이마에 붙은 내 숫자를 남들의 반응과 질문 카드로 추론한다. 먼저 맞히면 승리.' },
  { n:'카르카손', bl:{"rate": 7.6, "weight": 1.89, "rank": 158, "players": "2-5", "minutes": "30-45", "age": 7, "url": "https://boardlife.co.kr/game/135"}, img:'img/t/carcassonne.jpg', min:2, max:5, t:35, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'타일을 놓아 도시와 길을 만드는 영역 싸움.',
    r:'타일을 이어 붙이고 부하를 올려 도시·길·수도원을 완성한다. 완성된 지형의 크기만큼 점수.' },
  { n:'스플렌더', bl:{"rate": 7.7, "weight": 1.78, "rank": 112, "players": "2-4", "minutes": "30", "age": 10, "url": "https://boardlife.co.kr/game/3516"}, img:'img/t/splendor.jpg', min:2, max:4, t:30, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'보석을 모아 카드를 사고, 그 카드로 또 산다.',
    r:'토큰을 모아 개발 카드를 구입한다. 카드는 영구 보너스가 되어 다음 구입이 쉬워진다. 15점 먼저 도달하면 승리.' },
  { n:'카탄', bl:{"rate": 7.5, "weight": 2.29, "rank": 208, "players": "3-4", "minutes": "60-120", "age": 10, "url": "https://boardlife.co.kr/game/274"}, img:'img/t/catan.jpg', min:3, max:4, t:60, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'자원 교환과 협상. 유로게임의 교과서.',
    r:'주사위로 자원을 얻고 길·마을·도시를 건설한다. 부족한 자원은 다른 사람과 협상해 교환. 10점 먼저 도달하면 승리.' },
  { n:'카탄 (카드버전)', bl:{"rate": 6.0, "weight": 2.44, "rank": 2722, "players": "2-4", "minutes": "30", "age": 10, "url": "https://boardlife.co.kr/game/1145", "bgg": "https://boardgamegeek.com/boardgame/91534/struggle-catan"}, img:'img/t/catan-card.jpg', min:2, max:4, t:30, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'카탄을 카드로 압축한 버전. 시간이 절반.',
    r:'카드로 자원을 관리하며 자기 영지를 키운다. 보드판 없이 진행.' },
  { n:'루미큐브', bl:{"rate": 7.3, "weight": 1.71, "rank": 440, "players": "2-4", "minutes": "60", "age": 8, "url": "https://boardlife.co.kr/game/2061"}, img:'img/t/rummikub.jpg', min:2, max:4, t:20, cat:'strategy', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'숫자 타일로 하는 조합 게임. 룰이 직관적이다.',
    r:'같은 색 연속 또는 같은 숫자 세트를 만들어 내려놓는다. 판 위의 조합을 재배열해도 된다. 먼저 다 내려놓으면 승리.' },
  { n:'하모니즈', bl:{"rate": 7.7, "weight": 2.01, "rank": 128, "players": "1-4", "minutes": "30-45", "age": 10, "url": "https://boardlife.co.kr/game/19124", "bgg": "https://boardgamegeek.com/boardgame/414317/harmonies"}, img:'img/t/harmonies.jpg', min:1, max:4, t:30, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'조각을 쌓아 자연 지형을 만드는 퍼즐형 게임.',
    r:'색 토큰을 규칙에 맞게 쌓아 서식지를 만들고, 동물 카드 조건을 충족해 점수를 얻는다.' },
  { n:'봄버스터즈', bl:{"rate": 7.78, "weight": 1.96, "rank": 94, "players": "2-5", "minutes": "30", "age": 10, "url": "https://boardlife.co.kr/game/19722", "bgg": "https://boardgamegeek.com/boardgame/413246/bomb-busters"}, img:'img/t/bomb-busters.jpg', min:2, max:5, t:30, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'폭탄을 피하며 점수를 쌓는 카드 게임.',
    r:'카드를 뽑아 점수를 모으되 폭탄이 터지면 잃는다. 언제 멈출지 판단하는 게 핵심.' },
  { n:'상자아이', bl:{"rate": 6.4, "weight": 2.7, "rank": 1801, "players": "3-5", "minutes": "90-120", "age": 10, "url": "https://boardlife.co.kr/game/7737", "bgg": "https://boardgamegeek.com/boardgame/233848/hako-onna"}, img:'img/t/box-child.jpg', min:3, max:5, t:40, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'상자 속 정보를 다루는 중량감 있는 게임.',
    r:'제한된 정보로 상대의 수를 읽으며 점수를 쌓는다.' },
  { n:'쿼리도', bl:{"rate": 6.8, "weight": 1.82, "rank": 1118, "players": "2-4", "minutes": "15", "age": 8, "url": "https://boardlife.co.kr/game/1340"}, img:'img/t/quoridor.jpg', min:2, max:4, t:15, cat:'strategy', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'벽을 세워 길을 막는 2인 두뇌 게임.',
    r:'말을 반대편까지 옮기거나 벽을 세워 상대를 막는다. 완전히 가둘 수는 없다. 2인 또는 4인.' },
  { n:'체스 (미니)', min:2, max:2, t:20, cat:'strategy', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'둘이 남았을 때의 최후 수단.',
    r:'설명 생략.' },

  // ── 협력 ──────────────────────────────────
  { n:'더 갱', img:'img/t/the-gang.jpg', min:3, max:6, t:20, cat:'coop', lv:'중급', out:false, host:false, own:'채연주', have:true,
    d:'말 없이 포커 서열을 맞추는 협력 게임.',
    r:'각자 포커 패를 들고 대화 없이 강한 순서대로 줄을 선다. 순서가 맞으면 다 같이 승리.' },
  { n:'더마인드', bl:{"rate": 7.3, "weight": 1.08, "rank": 407, "players": "2-4", "minutes": "20", "age": 8, "url": "https://boardlife.co.kr/game/9684", "bgg": "https://boardgamegeek.com/boardgame/244992/the-mind"}, img:'img/t/the-mind.jpg', min:2, max:4, t:20, cat:'coop', lv:'초보', out:false, host:false, own:'채연주', have:true,
    d:'말하지 않고 숫자 순서를 맞춘다. 이상하게 통한다.',
    r:'각자 든 숫자 카드를 대화 없이 작은 순서대로 낸다. 순서가 틀리면 목숨이 깎인다.' },
  { n:'사건의재구성', bl:{"rate": 6.9, "weight": 2.06, "rank": 904, "players": "1-4", "minutes": "60-90", "age": 14, "url": "https://boardlife.co.kr/game/9665", "bgg": "https://boardgamegeek.com/boardgame/239188/chronicles-crime"}, img:'img/t/crime-scene.jpg', min:1, max:4, t:75, cat:'coop', lv:'고급', out:false, host:false, own:'채연주', have:true,
    d:'실제 사건 파일을 파고드는 본격 추리. 시간이 오래 걸린다.',
    r:'증거 자료를 읽고 추론해 사건을 재구성한다. 정답을 맞히는 방식. 4시간 회차에는 부담.' },
];

/* 카테고리 */
const CATS = [
  { k:'all',      label:'전체' },
  { k:'mafia',    label:'마피아류' },
  { k:'party',    label:'파티' },
  { k:'quick',    label:'순발력' },
  { k:'strategy', label:'전략' },
  { k:'coop',     label:'협력' },
];
