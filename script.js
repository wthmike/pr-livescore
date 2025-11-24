import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, onSnapshot, updateDoc, deleteDoc, addDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = { apiKey: "AIzaSyB_iLszALYkNYii1y9i9m309dMeod97Vr8", authDomain: "pr-acad-test.firebaseapp.com", projectId: "pr-acad-test", storageBucket: "pr-acad-test.firebasestorage.app", messagingSenderId: "1090953335490", appId: "1:1090953335490:web:ff63a07419b803ca44215b" };
const PIN_CODE = "PENRICE";

// Phrase Constants
const PHRASES = { 
    0: ["Solid defense.", "Straight to the fielder.", "Beaten outside off.", "No run.", "Good line and length.", "Watchful play.", "Can't get that away.", "Well fielded.", "Respects the good ball."], 
    1: ["Quick single taken.", "Pushed into the gap.", "Strike rotated.", "Good running.", "Dropped fast and they scramble.", "Working it around."], 
    2: ["Coming back for two.", "Good running between the wickets.", "Misfield allows the second.", "Nice placement for a couple.", "Pushing the fielder."], 
    3: ["Great running! Three taken.", "Chased down just inside the rope.", "They push hard for the third.", "Excellent fitness shown."], 
    4: ["CRUNCHED! Through the covers!", "Glorious shot! Four runs.", "Raced to the fence!", "Elegant drive!", "Short and punished!", "Finds the gap beautifully!", "One bounce and over!"], 
    6: ["MAXIMUM! That is huge!", "Into the next postcode!", "Clean hitting!", "Out of the ground!", "That's gone into orbit!", "Monster hit over the ropes!", "That's in the car park!"], 
    OUT_BOWLED: ["CLEAN BOWLED! What a delivery!", "Knocked him over! Timber!", "Through the gate!", "Middle stump uprooted!", "A jaffa! Stumps flying!"], 
    OUT_CAUGHT: ["CAUGHT! Straight to the fielder.", "Edged and gone!", "Snatched safely out of the air.", "Simple catch taken.", "Great hands in the deep!"], 
    OUT_LBW: ["LBW! Plumb in front!", "Trapped on the crease!", "Huge appeal... and given!", "Umpire raises the finger!", "Caught dead in front!"], 
    OUT_RO: ["RUN OUT! Disaster!", "Mix up in the middle!", "Direct hit found him short!", "Sent back too late!"], 
    OUT_ST: ["STUMPED! Quick hands by the keeper.", "Beaten in flight and gone!", "Dancing down the track and misses."], 
    OUT_GENERIC: ["WICKET! They have to go.", "Dismissed!", "A crucial breakthrough!"] 
};

let app, db, auth, fixtures = [], isAdmin = false, cardTabState = {};
const els = { root: document.getElementById('penrice-live-root'), publicView: document.getElementById('publicView'), grid: document.getElementById('fixturesGrid'), loading: document.getElementById('loadingState'), empty: document.getElementById('emptyState'), adminPanel: document.getElementById('adminPanel'), adminList: document.getElementById('adminMatchList'), loginModal: document.getElementById('loginModal'), pinInput: document.getElementById('pinInput'), pinError: document.getElementById('pinError'), newTeam: document.getElementById('newTeamInput'), newOpp: document.getElementById('newOpponentInput'), newFormat: document.getElementById('newFormatInput') };

// Initialize App
try {
    app = initializeApp(firebaseConfig); 
    db = getFirestore(app); 
    auth = getAuth(app); 
    signInAnonymously(auth);
    
    // Listen for updates
    onSnapshot(collection(db, 'matches'), (snapshot) => {
        fixtures = []; 
        snapshot.forEach(doc => fixtures.push({ id: doc.id, ...doc.data() }));
        // Sort: Live first, then by updated time
        fixtures.sort((a, b) => (a.status === 'LIVE' && b.status !== 'LIVE' ? -1 : (a.status !== 'LIVE' && b.status === 'LIVE' ? 1 : (b.lastUpdated || 0) - (a.lastUpdated || 0))));
        render();
    });

    // Set Date Header
    const d = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    document.getElementById('headerDate').textContent = d.toUpperCase(); 
    document.getElementById('headerDate2').textContent = d.toUpperCase();
} catch (e) { console.error(e); }

function render() {
    els.loading.style.display = 'none'; 
    els.grid.innerHTML = ''; 
    els.adminList.innerHTML = '';
    
    if (fixtures.length === 0) { 
        els.empty.style.display = 'flex'; 
    } else { 
        els.empty.style.display = 'none'; 
        fixtures.forEach(match => { 
            if(match.sport === 'cricket') { 
                els.grid.appendChild(createMatchCard(match)); 
                if(isAdmin) els.adminList.appendChild(createAdminCard(match)); 
            } 
        }); 
    }
}

// Global window functions for HTML event handlers
window.switchTab = (matchId, tab) => {
    cardTabState[matchId] = tab;
    const homeDiv = document.getElementById(`scorecard-home-${matchId}`);
    const awayDiv = document.getElementById(`scorecard-away-${matchId}`);
    const homeBtn = document.getElementById(`btn-home-${matchId}`);
    const awayBtn = document.getElementById(`btn-away-${matchId}`);
    
    if(homeDiv && awayDiv) {
        if(tab === 'home') { 
            homeDiv.classList.remove('hidden'); 
            awayDiv.classList.add('hidden'); 
            homeBtn?.classList.replace('tab-inactive', 'tab-active'); 
            awayBtn?.classList.replace('tab-inactive', 'tab-inactive'); 
        } else { 
            homeDiv.classList.add('hidden'); 
            awayDiv.classList.remove('hidden'); 
            homeBtn?.classList.replace('tab-active', 'tab-inactive'); 
            awayBtn?.classList.replace('tab-inactive', 'tab-active'); 
        }
    }
};

function generateScorecardHTML(battingStats, bowlingStats, strikerName) {
    let batRows = '', bowlRows = '';
    
    if (battingStats && Array.isArray(battingStats)) {
        batRows = battingStats.map(player => {
            let nameStyle = "text-slate-500 font-medium"; 
            if (player.status === 'batting') nameStyle = "text-penrice-navy font-bold"; 
            else if (player.status === 'out') nameStyle = "text-red-600 font-bold line-through decoration-2 decoration-red-600/50"; 
            
            return `<div class="flex justify-between items-center py-2 border-b border-gray-50 text-xs">
                <div class="flex-1">
                    <div class="${nameStyle}">${player.name} ${player.status === 'batting' && strikerName === player.name ? '🏏' : ''}</div>
                    ${player.dismissal ? `<div class="text-[10px] text-slate-400 mt-0.5">${player.dismissal}</div>` : ''}
                </div>
                <div class="font-display font-bold text-slate-800 text-sm w-12 text-right">${player.runs} <span class="text-slate-400 font-sans font-normal text-[10px]">(${player.balls})</span></div>
            </div>`;
        }).join('');
    }
    
    if (bowlingStats && Array.isArray(bowlingStats)) {
        const bowlers = bowlingStats.filter(p => (p.bowlBalls || 0) > 0 || (p.bowlWkts || 0) > 0);
        if (bowlers.length > 0) {
                bowlRows = `<div class="mt-4"><div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pb-1 border-b border-gray-100">Bowling Figures</div>
                ${bowlers.map(p => {
                const overs = Math.floor((p.bowlBalls || 0) / 6) + '.' + ((p.bowlBalls || 0) % 6);
                return `<div class="flex justify-between items-center py-1.5 border-b border-gray-50 text-xs text-slate-600">
                    <span class="font-bold text-slate-700">${p.name}</span>
                    <div class="flex gap-3 font-mono text-[10px]"><span>${overs}</span><span>${p.bowlRuns || 0}</span><span class="font-bold text-penrice-navy">${p.bowlWkts || 0}W</span></div>
                </div>`
                }).join('')}</div>`;
        }
    }
    return `<div>${batRows || '<div class="p-2 text-xs text-slate-400 italic">Lineups pending...</div>'}${bowlRows}</div>`;
}

function createMatchCard(match) {
    const isLive = match.status === 'LIVE', isResult = match.status === 'FT', anchor = document.createElement('div'); anchor.className = "card-anchor";
    const isPenriceBatting = match.penriceStatus === 'batting', homeScoreText = `${match.homeScore || 0}-${match.homeWickets || 0}`, awayScoreText = `${match.awayScore || 0}-${match.awayWickets || 0}`, currentOver = match.currentOver ? match.currentOver.toFixed(1) : "0.0";
    
    let eventsHTML = '';
    if (isLive && match.events && match.events.length > 0) {
        eventsHTML = match.events.slice().reverse().map(e => {
            const isWicket = e.type === 'WICKET' || e.type === 'HOWZAT!', isBoundary = e.type === '4' || e.type === '6';
            let duckBadge = ''; if (e.duckType === 'golden') duckBadge = `<span class="inline-block ml-2 bg-penrice-gold text-slate-900 text-[9px] font-bold px-1.5 py-px uppercase rounded-sm animate-pulse border border-yellow-500">QUACK QUACK!</span>`; else if (e.duckType === 'regular') duckBadge = `<span class="inline-block ml-2 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-px uppercase rounded-sm border border-black">QUACK!</span>`;
            let eventMarker = '';
            if(isWicket) eventMarker = `<span class="bg-red-600 text-white px-1.5 py-px text-[10px] font-display uppercase font-bold tracking-wider mr-2">HOWZAT!</span>`;
            else if(isBoundary) eventMarker = `<span class="inline-flex items-center justify-center w-6 h-6 border-2 border-penrice-navy text-penrice-navy font-bold text-xs rounded mr-2 pulsating-box">${e.type}</span>`;
            else eventMarker = `<span class="text-slate-500 mr-2 font-bold text-xs">${e.type}</span>`;
            
            return `<div class="relative pl-6 pb-6 last:pb-0"><div class="timeline-line"></div><div class="timeline-node ${isWicket ? '!bg-red-600 !border-red-600' : (isBoundary ? '!border-penrice-navy' : '')}"></div><div class="flex items-start gap-3"><div class="font-mono text-xs font-bold text-slate-400 w-8 pt-0.5">${e.time}</div><div class="flex-1"><div class="text-xs font-bold text-slate-800 uppercase flex flex-wrap items-center">${eventMarker} ${e.player}${duckBadge}</div>${e.desc ? `<div class="text-xs text-slate-600 mt-1 font-medium leading-relaxed">"${e.desc}"</div>` : ''}</div></div></div>`;
        }).join('');
    }
    
    if (!cardTabState[match.id]) cardTabState[match.id] = isPenriceBatting ? 'home' : 'away';
    const activeTab = cardTabState[match.id], homeHTML = generateScorecardHTML(match.homeTeamStats, match.awayTeamStats, match.currentStriker), awayHTML = generateScorecardHTML(match.awayTeamStats, match.homeTeamStats, match.currentStriker);
    
    let bowlerStatsText = '0-0 (0.0)';
    if (isLive && match.currentBowler) {
            const bowlingStats = isPenriceBatting ? match.awayTeamStats : match.homeTeamStats;
            const bowler = (bowlingStats || []).find(p => p.name === match.currentBowler);
            if (bowler) { const balls = bowler.bowlBalls || 0, overs = Math.floor(balls / 6) + '.' + (balls % 6); bowlerStatsText = `${bowler.bowlWkts || 0}-${bowler.bowlRuns || 0} (${overs})`; }
    }
    
    // Highlight Batting Team
    const homeHighlight = isPenriceBatting ? 'bg-yellow-50 border-l-4 border-penrice-gold pl-2 -ml-2 rounded-r-sm' : '';
    const awayHighlight = !isPenriceBatting ? 'bg-yellow-50 border-l-4 border-penrice-gold pl-2 -ml-2 rounded-r-sm' : '';

    anchor.innerHTML = `<div class="match-card group/card">
        <div class="bg-white px-6 py-3 border-b border-slate-100 flex justify-between items-center"><div class="flex items-center gap-3">${isLive ? `<span class="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider animate-pulse">LIVE</span>` : (isResult ? `<span class="bg-slate-800 text-white text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">RESULT</span>` : `<span class="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">UPCOMING</span>`)}<span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">${match.league || 'Fixture'} • ${match.format || 'Match'}</span></div>${isLive ? `<div class="text-[10px] font-bold text-slate-500 uppercase">${currentOver} OVERS</div>` : ''}</div>
        <div class="px-6 py-5">
            ${isResult && match.result ? `<div class="bg-penrice-navy text-white text-center py-2 font-display font-bold uppercase tracking-widest text-sm mb-4 rounded-sm shadow-sm border border-penrice-gold flex items-center justify-center gap-2"><i class="fa-solid fa-trophy text-penrice-gold"></i> ${match.result}</div>` : ''}
            <div class="flex justify-between items-center mb-2 ${homeHighlight} transition-all"><span class="font-display font-bold text-xl text-slate-900 uppercase ${isPenriceBatting ? 'text-penrice-navy' : ''}">${match.teamName} ${isPenriceBatting ? '<span class="text-penrice-gold text-lg ml-1">🏏</span>' : ''}</span><span class="font-display font-bold text-3xl text-slate-900 tracking-tight">${homeScoreText}</span></div>
            <div class="flex justify-between items-center ${awayHighlight} transition-all"><span class="font-display font-bold text-xl text-slate-900 uppercase ${!isPenriceBatting ? 'text-penrice-navy' : ''}">${match.opponent} ${!isPenriceBatting ? '<span class="text-penrice-gold text-lg ml-1">🏏</span>' : ''}</span><span class="font-display font-bold text-3xl text-slate-900 tracking-tight">${awayScoreText}</span></div>
            ${isLive ? `<div class="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-8"><div><div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">At Bat</div><div class="flex flex-col gap-1"><div class="flex justify-between text-xs font-bold text-slate-800"><span>${match.currentStriker || 'Striker'} 🏏</span><span class="text-slate-500 font-mono">${(match[isPenriceBatting ? 'homeTeamStats' : 'awayTeamStats'] || []).find(p=>p.name===match.currentStriker)?.runs || 0}</span></div><div class="flex justify-between text-xs font-medium text-slate-500"><span>${match.currentNonStriker || 'Non-Striker'}</span><span class="font-mono opacity-60">${(match[isPenriceBatting ? 'homeTeamStats' : 'awayTeamStats'] || []).find(p=>p.name===match.currentNonStriker)?.runs || 0}</span></div></div></div><div class="border-l border-slate-100 pl-8"><div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Bowling</div><div class="text-xs font-bold text-slate-800">${match.currentBowler || 'Changing'}</div><div class="text-[10px] text-slate-500 mt-0.5 font-mono">${bowlerStatsText}</div></div></div>` : ''}
        </div>
        <div class="bg-slate-50 py-1.5 flex justify-center border-t border-slate-100"><i class="fa-solid fa-chevron-down text-[10px] text-slate-300"></i></div>
        <div class="match-insights" data-lenis-prevent><div class="flex flex-col md:flex-row bg-white h-[50vh] w-full shrink-0"><div class="w-full md:w-5/12 bg-slate-50/50 p-5 border-r border-slate-100 custom-scroll overflow-y-auto h-full" data-lenis-prevent><div class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 sticky top-0 bg-slate-50/95 py-2 z-10 w-full border-b border-slate-100">Live Commentary</div><div class="relative pt-2">${eventsHTML || '<div class="text-center text-xs text-slate-400 py-10 italic">Waiting for play to start...</div>'}</div></div><div class="w-full md:w-7/12 p-5 custom-scroll overflow-y-auto h-full" data-lenis-prevent><div class="flex gap-4 mb-4 border-b border-slate-100 pb-3 sticky top-0 bg-white z-10"><button id="btn-home-${match.id}" onclick="window.switchTab('${match.id}', 'home')" class="tab-btn ${activeTab === 'home' ? 'tab-active' : 'tab-inactive'}">${match.teamName}</button><button id="btn-away-${match.id}" onclick="window.switchTab('${match.id}', 'away')" class="tab-btn ${activeTab === 'away' ? 'tab-active' : 'tab-inactive'}">${match.opponent}</button></div><div id="scorecard-home-${match.id}" class="${activeTab === 'home' ? 'block' : 'hidden'}">${homeHTML}</div><div id="scorecard-away-${match.id}" class="${activeTab === 'away' ? 'block' : 'hidden'}">${awayHTML}</div></div></div></div>
    </div>`;
    return anchor;
}

function createAdminCard(match) {
    const card = document.createElement('div'); card.className = "bg-white border border-gray-200 p-5 shadow-sm mb-4 relative hover:border-penrice-navy transition-colors";
    const hasTeams = match.homeTeamStats && match.homeTeamStats.length > 0, isPenriceBatting = match.penriceStatus === 'batting', battingStats = isPenriceBatting ? match.homeTeamStats : match.awayTeamStats, bowlingStats = isPenriceBatting ? match.awayTeamStats : match.homeTeamStats, availableBatters = hasTeams ? battingStats.filter(p => p.status !== 'out') : [];
    let controls = '';
    
    // Editable Scores
    const currentRuns = isPenriceBatting ? match.homeScore : match.awayScore;
    const currentWkts = isPenriceBatting ? match.homeWickets : match.awayWickets;
    const scoreEditHTML = hasTeams ? `
        <div class="bg-yellow-50/50 border border-yellow-100 p-2 mb-3 flex items-center justify-between">
                <div class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Score Correction</div>
                <div class="flex gap-3">
                    <div class="flex items-center gap-1">
                    <span class="text-[10px] font-bold text-slate-500">R:</span>
                    <input type="number" class="w-12 text-center text-xs font-bold border border-slate-200 bg-white" value="${currentRuns||0}" onchange="window.manualScoreUpdate('${match.id}', 'runs', this.value)">
                    </div>
                    <div class="flex items-center gap-1">
                    <span class="text-[10px] font-bold text-slate-500">W:</span>
                    <input type="number" class="w-10 text-center text-xs font-bold border border-slate-200 bg-white" value="${currentWkts||0}" onchange="window.manualScoreUpdate('${match.id}', 'wickets', this.value)">
                    </div>
                </div>
        </div>
    ` : '';

    if (!hasTeams) {
        controls = `<div class="mt-4 bg-slate-50 p-4 border border-slate-200"><h5 class="text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Initialize Teams</h5><div class="grid grid-cols-2 gap-4 mb-4"><div><label class="text-[10px] font-bold text-slate-400 block mb-1 uppercase">${match.teamName}</label><textarea id="homeTeamList-${match.id}" class="w-full text-xs p-2 border border-slate-300 h-32 font-mono" placeholder="Player 1&#10;Player 2..."></textarea></div><div><label class="text-[10px] font-bold text-slate-400 block mb-1 uppercase">${match.opponent}</label><textarea id="awayTeamList-${match.id}" class="w-full text-xs p-2 border border-slate-300 h-32 font-mono" placeholder="Player 1&#10;Player 2..."></textarea></div></div><div class="flex gap-6 mb-4"><label class="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer"><input type="radio" name="batFirst-${match.id}" value="penrice" checked> ${match.teamName} Bat 1st</label><label class="text-xs font-bold text-slate-700 flex items-center gap-2 cursor-pointer"><input type="radio" name="batFirst-${match.id}" value="opponent"> ${match.opponent} Bat 1st</label></div><button onclick="window.setupTeams('${match.id}')" class="w-full bg-slate-900 text-white font-bold py-2 text-xs uppercase tracking-widest hover:bg-slate-800">Start Match</button></div>`;
    } else {
        const strikerOptions = availableBatters.map(p => `<option value="${p.name}" ${match.currentStriker === p.name ? 'selected' : ''}>${p.name} ${p.status === 'batting' ? '🏏' : ''}</option>`).join(''), nonStrikerOptions = availableBatters.map(p => `<option value="${p.name}" ${match.currentNonStriker === p.name ? 'selected' : ''}>${p.name} ${p.status === 'batting' ? '🏏' : ''}</option>`).join(''), bowlerOptions = bowlingStats && bowlingStats.length > 0 ? bowlingStats.map(p => `<option value="${p.name}" ${match.currentBowler === p.name ? 'selected' : ''}>${p.name}</option>`).join('') : '<option value="">No Team Data</option>', fielderOptions = bowlingStats && bowlingStats.length > 0 ? bowlingStats.map(p => `<option value="${p.name}">${p.name}</option>`).join('') : '<option value="">Unknown</option>';
        controls = `${scoreEditHTML}<div class="mt-4 grid grid-cols-2 gap-4 bg-slate-50 p-3 border border-slate-200"><div><label class="text-[9px] font-bold text-penrice-navy block mb-1 uppercase">Striker</label><select onchange="window.updateField('${match.id}', 'currentStriker', this.value)" class="penrice-input text-xs h-8 bg-white border-b-slate-300"><option value="">Select</option>${strikerOptions}</select></div><div><label class="text-[9px] font-bold text-slate-500 block mb-1 uppercase">Non-Striker</label><select onchange="window.updateField('${match.id}', 'currentNonStriker', this.value)" class="penrice-input text-xs h-8 bg-white border-b-slate-300"><option value="">Select</option>${nonStrikerOptions}</select></div></div><div class="mt-2 mb-4 bg-slate-50 p-3 border border-slate-200 border-t-0"><label class="text-[9px] font-bold text-slate-500 block mb-1 uppercase">Current Bowler (${isPenriceBatting ? match.opponent : match.teamName})</label><select onchange="window.updateField('${match.id}', 'currentBowler', this.value)" class="penrice-input text-xs h-8 bg-white border-b-slate-300"><option value="">Select Bowler</option>${bowlerOptions}</select></div>
        <div id="wicket-modal-${match.id}" class="hidden bg-red-50 p-4 border border-red-100 mb-4"><h5 class="text-xs font-bold text-red-800 mb-3 uppercase tracking-widest">Process Wicket</h5><div class="mb-3"><label class="text-[9px] font-bold text-slate-500 uppercase block mb-1">Dismissal Type</label><select id="wktMethod-${match.id}" onchange="window.toggleFielderSelect('${match.id}', this.value)" class="penrice-input text-xs bg-white h-9"><option value="Bowled">Bowled</option><option value="Caught">Caught</option><option value="LBW">LBW</option><option value="Run Out">Run Out</option><option value="Stumped">Stumped</option><option value="Hit Wicket">Hit Wicket</option><option value="Other">Other</option></select></div><div id="wktFielderDiv-${match.id}" class="mb-4 hidden"><label class="text-[9px] font-bold text-slate-500 uppercase block mb-1">Fielder Involved</label><select id="wktFielder-${match.id}" class="penrice-input text-xs bg-white h-9"><option value="">Select Fielder</option>${fielderOptions}</select></div><div class="grid grid-cols-2 gap-3"><button onclick="window.toggleWicketMode('${match.id}', false)" class="bg-white text-slate-600 border border-slate-200 text-xs font-bold py-2 uppercase">Cancel</button><button onclick="window.commitWicket('${match.id}')" class="bg-red-600 text-white text-xs font-bold py-2 uppercase hover:bg-red-700">Confirm OUT</button></div></div>
        <div id="score-keypad-${match.id}"><div class="flex items-center justify-between mb-3 bg-white border border-slate-200 p-2"><div class="flex items-center gap-2"><span class="text-[10px] font-bold text-slate-400 uppercase">Overs:</span><input type="number" step="0.1" value="${match.currentOver || 0}" class="w-16 text-center border-b border-slate-300 text-sm font-bold font-mono outline-none" onchange="window.updateField('${match.id}', 'currentOver', parseFloat(this.value))"></div><div class="text-[10px] font-bold ${isPenriceBatting ? 'text-penrice-navy' : 'text-slate-500'} uppercase">${isPenriceBatting ? match.teamName : match.opponent} Batting</div></div><div class="grid grid-cols-4 gap-2 select-none"><div onclick="window.scoreInput('${match.id}', 0)" class="score-key text-sm">DOT</div><div onclick="window.scoreInput('${match.id}', 1)" class="score-key">1</div><div onclick="window.scoreInput('${match.id}', 2)" class="score-key">2</div><div onclick="window.scoreInput('${match.id}', 3)" class="score-key">3</div><div onclick="window.scoreInput('${match.id}', 4)" class="score-key text-penrice-navy bg-blue-50/50">4</div><div onclick="window.scoreInput('${match.id}', 6)" class="score-key text-penrice-navy bg-blue-50/50">6</div><div onclick="window.scoreInput('${match.id}', 'WD')" class="score-key text-sm bg-orange-50 text-orange-800">WD</div><div onclick="window.scoreInput('${match.id}', 'NB')" class="score-key text-sm bg-orange-50 text-orange-800">NB</div><div onclick="window.scoreInput('${match.id}', 'BYE')" class="score-key text-sm">BYE</div><div onclick="window.scoreInput('${match.id}', 'LB')" class="score-key text-sm">LB</div><div onclick="window.toggleWicketMode('${match.id}', true)" class="score-key !bg-red-600 !text-white !border-red-700 hover:!bg-red-700 text-sm">OUT</div><div onclick="window.endOver('${match.id}')" class="score-key bg-slate-900 text-white border-slate-900 hover:bg-slate-800 text-[10px] leading-tight flex flex-col justify-center">END<br>OVER</div></div></div><button onclick="window.undoLastAction('${match.id}')" class="w-full mt-2 bg-slate-200 text-slate-600 hover:text-red-600 border border-slate-300 text-xs font-bold py-2 uppercase tracking-wider hover:bg-slate-300 mb-2"><i class="fa-solid fa-rotate-left mr-2"></i> Undo Last Ball</button><button onclick="window.switchInnings('${match.id}')" class="w-full mt-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold py-2 uppercase tracking-wider hover:bg-slate-50">End Innings / Switch Teams</button>`;
    }
    card.innerHTML = `<div class="flex justify-between items-start mb-4"><div class="flex flex-col"><span class="text-[10px] font-bold text-penrice-gold uppercase tracking-widest">Admin Control</span><h4 class="font-display font-bold text-xl text-slate-900 mt-0.5 uppercase tracking-tight">${match.teamName} v ${match.opponent}</h4></div><button onclick="window.deleteMatch('${match.id}')" class="text-slate-300 hover:text-red-500 transition-colors bg-white border border-slate-200 p-2 hover:bg-red-50"><i class="fa-solid fa-trash-can"></i></button></div><div class="grid grid-cols-2 gap-4 mb-4"><select onchange="window.updateField('${match.id}', 'status', this.value)" class="penrice-input text-xs font-bold py-2 uppercase h-10"><option value="UPCOMING" ${match.status === 'UPCOMING' ? 'selected' : ''}>Upcoming</option><option value="LIVE" ${match.status === 'LIVE' ? 'selected' : ''}>LIVE</option><option value="FT" ${match.status === 'FT' ? 'selected' : ''}>Result</option></select><input type="text" value="${match.league || ''}" onchange="window.updateField('${match.id}', 'league', this.value)" class="penrice-input text-xs py-2 h-10" placeholder="League Name"></div><input type="text" value="${match.format || ''}" onchange="window.updateField('${match.id}', 'format', this.value)" class="penrice-input text-xs py-2 h-10 mb-4" placeholder="Format (e.g. T20)">${controls}`;
    return card;
}

// Event Listeners for DOM elements
document.getElementById('adminToggleBtn').addEventListener('click', () => { 
    if (isAdmin) { 
        isAdmin = false; 
        toggleAdminView(false); 
        render(); 
    } else { 
        els.loginModal.classList.remove('hidden'); 
        setTimeout(() => els.pinInput.focus(), 100); 
    } 
});

document.getElementById('cancelLoginBtn').addEventListener('click', () => { 
    els.loginModal.classList.add('hidden'); 
    els.pinInput.value = ''; 
});

document.getElementById('submitLoginBtn').addEventListener('click', () => { 
    if (els.pinInput.value === PIN_CODE) { 
        isAdmin = true; 
        els.loginModal.classList.add('hidden'); 
        toggleAdminView(true); 
        els.pinInput.value = ''; 
        els.pinError.classList.add('hidden'); 
        render(); 
    } else { 
        els.pinError.classList.remove('hidden'); 
        els.pinInput.classList.add('border-red-500'); 
        setTimeout(() => els.pinInput.classList.remove('border-red-500'), 1000); 
    } 
});

document.getElementById('closeAdminBtn').addEventListener('click', () => toggleAdminView(false));
document.getElementById('refreshBtn').addEventListener('click', () => { 
    els.root.classList.add('opacity-70'); 
    setTimeout(() => els.root.classList.remove('opacity-70'), 300); 
});

function toggleAdminView(show) { 
    if(show) { 
        els.publicView.classList.add('hidden'); 
        els.adminPanel.classList.remove('hidden'); 
        document.getElementById('adminToggleBtn').textContent = 'Logout'; 
    } else { 
        els.publicView.classList.remove('hidden'); 
        els.adminPanel.classList.add('hidden'); 
        document.getElementById('adminToggleBtn').textContent = 'Staff Login'; 
    } 
}

// Window functions for database operations
window.updateField = async (id, field, value) => { 
    await updateDoc(doc(db, 'matches', id), { [field]: value, lastUpdated: Date.now() }); 
};

window.setupTeams = async (id) => {
    const hVal = document.getElementById(`homeTeamList-${id}`).value.trim();
    const aVal = document.getElementById(`awayTeamList-${id}`).value.trim();
    const batFirst = document.querySelector(`input[name="batFirst-${id}"]:checked`).value;
    
    if(!hVal || !aVal) return alert("Enter both teams");
    
    const createStats = (names, isBatting) => names.map((name, i) => ({ 
        name, runs: 0, balls: 0, status: isBatting && i < 2 ? 'batting' : 'waiting', dismissal: '', bowlBalls: 0, bowlRuns: 0, bowlWkts: 0 
    }));
    
    const hL = hVal.split('\n').map(n=>n.trim()).filter(n=>n);
    const aL = aVal.split('\n').map(n=>n.trim()).filter(n=>n);
    const isPenBat = batFirst === 'penrice';
    
    await updateDoc(doc(db, 'matches', id), { 
        homeTeamStats: createStats(hL, isPenBat), 
        awayTeamStats: createStats(aL, !isPenBat), 
        currentStriker: isPenBat ? hL[0] : aL[0], 
        currentNonStriker: isPenBat ? hL[1] : aL[1], 
        penriceStatus: isPenBat ? 'batting' : 'bowling', 
        currentOver: 0.0, 
        homeScore: 0, homeWickets: 0, awayScore: 0, awayWickets: 0, 
        lastUpdated: Date.now() 
    });
};

window.toggleWicketMode = (id, show) => { 
    const k = document.getElementById(`score-keypad-${id}`);
    const w = document.getElementById(`wicket-modal-${id}`); 
    if(show) { k.classList.add('hidden'); w.classList.remove('hidden'); } 
    else { k.classList.remove('hidden'); w.classList.add('hidden'); } 
};

window.toggleFielderSelect = (id, method) => { 
    const d = document.getElementById(`wktFielderDiv-${id}`); 
    if(method === 'Caught' || method === 'Run Out' || method === 'Stumped') d.classList.remove('hidden'); 
    else d.classList.add('hidden'); 
};

window.commitWicket = async (id) => {
    const match = fixtures.find(m => m.id === id); if(!match) return;
    const method = document.getElementById(`wktMethod-${id}`).value;
    const fielder = document.getElementById(`wktFielder-${id}`).value;
    const bowler = match.currentBowler || 'Unknown';
    
    let dismissalText = method === 'Bowled' ? `b ${bowler}` : 
                        method === 'LBW' ? `lbw b ${bowler}` : 
                        method === 'Caught' ? `c ${fielder || 'Sub'} b ${bowler}` : 
                        method === 'Run Out' ? `run out (${fielder || 'Sub'})` : 
                        method === 'Stumped' ? `st ${fielder || 'Sub'} b ${bowler}` : 
                        method === 'Hit Wicket' ? `hit wicket b ${bowler}` : 
                        `Dismissed (${method})`;
                        
    await window.scoreInput(id, 'WICKET', dismissalText);
};

window.switchInnings = async (id) => {
    const match = fixtures.find(m => m.id === id); 
    if(!match || !confirm("Switch Innings? This will reset strikers.")) return;
    
    const isCurrentlyBatting = match.penriceStatus === 'batting';
    const newStatus = isCurrentlyBatting ? 'bowling' : 'batting';
    const prevBattingStatsKey = isCurrentlyBatting ? 'homeTeamStats' : 'awayTeamStats';
    const nextBattingStatsKey = isCurrentlyBatting ? 'awayTeamStats' : 'homeTeamStats';
    
    const prevBattingList = (match[prevBattingStatsKey] || []).map(p => ({...p}));
    const nextBattingList = (match[nextBattingStatsKey] || []).map(p => ({...p}));
    
    prevBattingList.forEach(p => { if(p.status === 'batting') p.status = 'not out'; }); 
    nextBattingList.forEach(p => { if(p.status === 'batting') p.status = 'waiting'; });
    
    const p1 = nextBattingList[0]?.name || '';
    const p2 = nextBattingList[1]?.name || ''; 
    if(nextBattingList[0]) nextBattingList[0].status = 'batting'; 
    if(nextBattingList[1]) nextBattingList[1].status = 'batting';
    
    cardTabState[id] = newStatus === 'batting' ? 'home' : 'away';
    
    await updateDoc(doc(db, 'matches', id), { 
        penriceStatus: newStatus, 
        currentOver: 0.0, 
        currentStriker: p1, 
        currentNonStriker: p2, 
        currentBowler: '', 
        [prevBattingStatsKey]: prevBattingList, 
        [nextBattingStatsKey]: nextBattingList, 
        events: [...(match.events||[]), { type: 'INNINGS BREAK', player: '', time: 'END', desc: 'Innings Closed. Teams Switched.' }] 
    });
};

window.manualScoreUpdate = async (id, type, value) => {
    const match = fixtures.find(m => m.id === id); if(!match) return;
    const isHome = match.penriceStatus === 'batting';
    const key = type === 'runs' ? (isHome ? 'homeScore' : 'awayScore') : (isHome ? 'homeWickets' : 'awayWickets');
    await updateDoc(doc(db, 'matches', id), { [key]: parseInt(value) });
};

window.undoLastAction = async (id) => {
    const match = fixtures.find(m => m.id === id);
    if(!match || !match.history || match.history.length === 0) return alert("No history to undo!");
    
    const history = [...match.history];
    const lastState = history.pop(); // Remove last state from array and get it
    
    // Restore specific fields from the snapshot
    await updateDoc(doc(db, 'matches', id), {
        homeScore: lastState.homeScore, awayScore: lastState.awayScore,
        homeWickets: lastState.homeWickets, awayWickets: lastState.awayWickets,
        currentOver: lastState.currentOver,
        homeTeamStats: lastState.homeTeamStats, awayTeamStats: lastState.awayTeamStats,
        events: lastState.events,
        currentStriker: lastState.currentStriker,
        currentNonStriker: lastState.currentNonStriker,
        currentBowler: lastState.currentBowler,
        penriceStatus: lastState.penriceStatus,
        history: history
    });
};

window.endGame = async (id, resultText) => {
    const match = fixtures.find(m => m.id === id);
    await updateDoc(doc(db, 'matches', id), {
        status: 'FT',
        result: resultText,
        events: [...(match.events||[]), { type: 'MATCH END', player: '', time: 'FT', desc: resultText }]
    });
};

window.scoreInput = async (id, type, dismissalDesc) => {
    const match = fixtures.find(m => m.id === id); if(!match) return;
    if (!match.currentBowler && type !== 'END') return alert("Please select a bowler for this over first!");
    
    // --- SAVE STATE FOR UNDO ---
    const historySnapshot = {
        homeScore: match.homeScore, awayScore: match.awayScore,
        homeWickets: match.homeWickets, awayWickets: match.awayWickets,
        currentOver: match.currentOver,
        homeTeamStats: match.homeTeamStats, awayTeamStats: match.awayTeamStats,
        events: match.events || [],
        currentStriker: match.currentStriker,
        currentNonStriker: match.currentNonStriker,
        currentBowler: match.currentBowler,
        penriceStatus: match.penriceStatus
    };
    const currentHistory = match.history || [];
    if(currentHistory.length > 5) currentHistory.shift(); 
    // ---------------------------

    const isHome = match.penriceStatus === 'batting';
    const statsKey = isHome ? 'homeTeamStats' : 'awayTeamStats';
    const bowlStatsKey = isHome ? 'awayTeamStats' : 'homeTeamStats';
    
    let stats = [...(match[statsKey] || [])];
    let bowlStats = [...(match[bowlStatsKey] || [])];
    let score = match[isHome?'homeScore':'awayScore'] || 0;
    let wickets = match[isHome?'homeWickets':'awayWickets'] || 0;
    let over = match.currentOver || 0;
    let sName = match.currentStriker;
    let nsName = match.currentNonStriker;
    
    const sIdx = stats.findIndex(p => p.name === sName); if(sIdx === -1 && type !== 'END') return alert("Select striker");
    const bName = match.currentBowler, bIdx = bowlStats.findIndex(p => p.name === bName);
    
    let runs = 0, faced = false, isWkt = false, desc = '', evtType = '', duckType = null;

    if (typeof type === 'number') {
        runs = type; faced = true; 
        evtType = type === 0 ? '.' : (type === 4 ? '4' : (type === 6 ? '6' : 'RUN')); 
        stats[sIdx].runs += runs; stats[sIdx].balls += 1;
        if(bIdx !== -1) { 
            bowlStats[bIdx].bowlBalls = (bowlStats[bIdx].bowlBalls || 0) + 1; 
            bowlStats[bIdx].bowlRuns = (bowlStats[bIdx].bowlRuns || 0) + runs; 
        }
        const pList = PHRASES[type] || [`${type} runs added.`]; 
        desc = pList[Math.floor(Math.random() * pList.length)];
    } else if (['WD','NB'].includes(type)) {
        runs = 1; evtType = type; 
        desc = type === 'WD' ? "Wide ball signalled." : "No ball! Free hit coming?"; 
        if(bIdx !== -1) bowlStats[bIdx].bowlRuns = (bowlStats[bIdx].bowlRuns || 0) + 1;
    } else if (['BYE','LB'].includes(type)) {
        runs = 1; faced = true; 
        stats[sIdx].balls += 1; evtType = type; 
        desc = type === 'BYE' ? "Byes signaled." : "Leg byes given."; 
        if(bIdx !== -1) bowlStats[bIdx].bowlBalls = (bowlStats[bIdx].bowlBalls || 0) + 1;
    } else if (type === 'WICKET') {
        isWkt = true; faced = true; 
        stats[sIdx].balls += 1; stats[sIdx].status = 'out'; wickets += 1; 
        stats[sIdx].dismissal = dismissalDesc || 'Out'; evtType = 'HOWZAT!'; 
        
        if (stats[sIdx].runs === 0) duckType = stats[sIdx].balls === 1 ? 'golden' : 'regular';
        
        if(duckType === 'golden') desc = "GOLDEN DUCK! First ball! Absolute disaster for the batter!";
        else if(duckType === 'regular') desc = "Gone for a DUCK! Fails to trouble the scorers today.";
        else {
            let dT = dismissalDesc || "";
            if(dT.startsWith('b ')) desc = PHRASES.OUT_BOWLED[Math.floor(Math.random()*PHRASES.OUT_BOWLED.length)];
            else if(dT.startsWith('c ')) desc = PHRASES.OUT_CAUGHT[Math.floor(Math.random()*PHRASES.OUT_CAUGHT.length)];
            else if(dT.startsWith('lbw')) desc = PHRASES.OUT_LBW[Math.floor(Math.random()*PHRASES.OUT_LBW.length)];
            else if(dT.startsWith('st')) desc = PHRASES.OUT_ST[Math.floor(Math.random()*PHRASES.OUT_ST.length)];
            else if(dT.toLowerCase().includes('run out')) desc = PHRASES.OUT_RO[Math.floor(Math.random()*PHRASES.OUT_RO.length)];
            else desc = PHRASES.OUT_GENERIC[Math.floor(Math.random()*PHRASES.OUT_GENERIC.length)];
            desc += ` (${dismissalDesc})`;
        }
        desc = `WICKET! ${sName} departs. ${desc}`;
        
        if(bIdx !== -1) { 
            bowlStats[bIdx].bowlBalls = (bowlStats[bIdx].bowlBalls || 0) + 1; 
            if(!dismissalDesc.includes('Run Out')) bowlStats[bIdx].bowlWkts = (bowlStats[bIdx].bowlWkts || 0) + 1; 
        }
        const nIdx = stats.findIndex(p => p.status === 'waiting'); 
        if(nIdx !== -1) { stats[nIdx].status = 'batting'; sName = stats[nIdx].name; } 
        else sName = '';
    }
    
    score += runs; 
    if (faced) { 
        let fl = Math.floor(over), b = Math.round((over - fl) * 10) + 1; 
        over = b >= 6 ? fl + 0.6 : fl + (b * 0.1); 
    }
    
    if (typeof type === 'number' && (type % 2 !== 0)) { 
        let t = sName; sName = nsName; nsName = t; 
    }
    
    await updateDoc(doc(db, 'matches', id), { 
        [statsKey]: stats, [bowlStatsKey]: bowlStats, 
        [isHome?'homeScore':'awayScore']: score, 
        [isHome?'homeWickets':'awayWickets']: wickets, 
        currentOver: parseFloat(over.toFixed(1)), 
        currentStriker: sName, currentNonStriker: nsName, 
        events: [...(match.events || []), { type: evtType, player: isWkt ? stats[sIdx].name : match.currentStriker, time: `Ov ${Math.floor(over)}.${Math.round((over%1)*10)}`, desc: desc, duckType: duckType }], 
        history: [...currentHistory, historySnapshot], 
        lastUpdated: Date.now() 
    });
    
    // Auto-Conclusion Logic
    const isSecondInnings = (match.events || []).some(e => e.type === 'INNINGS BREAK');
    const maxOvers = match.maxOvers || 20;
    const otherScore = isHome ? match.awayScore : match.homeScore;
    const teamName = isHome ? match.teamName : match.opponent;
    const otherTeamName = isHome ? match.opponent : match.teamName;
    const isOverComplete = Math.round((over % 1) * 10) === 6;

    if (isSecondInnings) {
        if (score > otherScore) {
            if(confirm(`Target Chased Down! ${teamName} wins! End Game?`)) {
                await window.endGame(id, `${teamName} won by ${10 - wickets} wickets`);
                return;
            }
        }
        const isAllOut = wickets >= 10;
        const isOversDone = isOverComplete && (Math.floor(over) + 1 >= maxOvers);
        
        if (isAllOut || isOversDone) {
            if (score > otherScore) { /* Already handled */ } 
            else if (score === otherScore) {
                if(confirm(`Match Tied! End Game?`)) await window.endGame(id, "Match Tied");
            } else {
                const diff = otherScore - score;
                const reason = isAllOut ? "All Out" : "Overs Complete";
                if(confirm(`${reason}. ${otherTeamName} wins by ${diff} runs. End Game?`)) {
                        await window.endGame(id, `${otherTeamName} won by ${diff} runs`);
                }
            }
            return;
        }
    } else {
        const isAllOut = wickets >= 10;
        const isOversDone = isOverComplete && (Math.floor(over) + 1 >= maxOvers);
        if (isAllOut && confirm("All Out! Switch Innings?")) { window.switchInnings(id); return; }
        if (isOversDone && confirm(`Innings Complete (${maxOvers} overs). Switch Innings?`)) { window.switchInnings(id); return; }
    }

    if (isOverComplete) {
        if(confirm("Over Complete. Start new over?")) window.endOver(id);
    }
};

window.endOver = async (id) => { 
    const m = fixtures.find(f => f.id === id); if(!m) return; 
    const nO = Math.floor(m.currentOver || 0) + 1.0; 
    await updateDoc(doc(db, 'matches', id), { 
        currentOver: nO, 
        currentStriker: m.currentNonStriker, 
        currentNonStriker: m.currentStriker, 
        currentBowler: '', 
        events: [...(m.events||[]), { type: 'END OVER', player: '', time: `Ov ${nO}`, desc: `End of Over.` }], 
        lastUpdated: Date.now() 
    }); 
};

window.deleteMatch = async (id) => { 
    if(confirm("Delete fixture?")) await deleteDoc(doc(db, 'matches', id)); 
};

document.getElementById('createNewMatchBtn').addEventListener('click', async () => { 
    const t = els.newTeam.value || 'Penrice';
    const o = els.newOpp.value;
    const ovs = els.newFormat.value; 
    
    if(!o || !ovs) return alert("Enter opponent and overs"); 
    
    await addDoc(collection(db, 'matches'), { 
        sport: 'cricket', teamName: t, opponent: o, 
        format: `${ovs} Overs`, maxOvers: parseInt(ovs), 
        status: 'UPCOMING', league: 'School Fixture', 
        lastUpdated: Date.now(), homeTeamStats: [], awayTeamStats: [], 
        homeScore: 0, homeWickets: 0, awayScore: 0, awayWickets: 0 
    }); 
    
    els.newOpp.value = ''; els.newFormat.value = ''; 
});
