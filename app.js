(function () {
  'use strict';

  /* ---------- mix your own ---------- */
  var bottles = Array.prototype.slice.call(document.querySelectorAll('.bottle'));
  var titleEl = document.getElementById('mix-title');
  var textEl = document.getElementById('mix-text');
  var dropsEl = document.getElementById('mix-drops');

  function updateMix() {
    var chosen = bottles.filter(function (b) { return b.getAttribute('aria-pressed') === 'true'; });
    var names = chosen.map(function (b) { return b.dataset.name; });
    var shorts = chosen.map(function (b) { return b.dataset.short; });
    var t = 'ยังไม่ได้เลือกขวด';
    var x = 'แตะขวดด้านบนอย่างน้อยหนึ่งขวด จะบอกวิธีหยดให้';
    var d = 'หยดแค่ 1–2 หยดก็พอ';
    if (chosen.length === 1) {
      t = 'กลิ่นเดี่ยว · ' + names[0];
      x = 'ปล่อยให้กลิ่นเดียวพูดเต็มเสียง: ' + shorts[0];
      d = 'หยด 1–2 หยดจากขวดนี้';
    } else if (chosen.length === 2) {
      t = 'สองกลิ่นซ้อนกัน · ' + names.join(' + ');
      x = shorts[0] + ' ซ้อนกับ ' + shorts[1];
      d = 'หยดขวดละ 1 หยด แล้วดมก่อนเติม';
    } else if (chosen.length === 3) {
      t = 'ครบทั้งสามกลิ่น · ' + names.join(' + ');
      x = shorts.join(' · ');
      d = 'หยดขวดละ 1 หยด แล้วรอสักครู่ก่อนเติม';
    }
    titleEl.textContent = t;
    textEl.textContent = x;
    dropsEl.textContent = d;
  }

  bottles.forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.getAttribute('aria-pressed') === 'true';
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
      b.querySelector('.no').textContent = 'ขวด ' + b.dataset.no + ' · ' + (on ? 'แตะเพื่อเลือก' : 'เลือกแล้ว');
      updateMix();
    });
  });

  /* ---------- ambient sound ---------- */
  var btn = document.getElementById('sound-btn');
  if (!btn) { return; }
  var ctx = null, timers = [], audio = null, playing = false;
  var kind = document.body.dataset.sound || 'bell';
  var audioFile = document.body.dataset.audio || '';

  function stop() {
    timers.forEach(function (t) { clearInterval(t); });
    timers = [];
    try { if (ctx) { ctx.close(); } } catch (e) {}
    ctx = null;
    try { if (audio) { audio.pause(); } } catch (e) {}
    audio = null;
    playing = false;
    btn.textContent = 'เปิดเสียงบรรยากาศ';
    btn.setAttribute('aria-pressed', 'false');
  }

  function start() {
    try {
      if (audioFile) {
        audio = new Audio(audioFile);
        audio.loop = true;
        audio.volume = 0.6;
        audio.play();
      } else {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return; }
        ctx = new AC();
        var out = ctx.createGain();
        out.gain.value = 0.55;
        out.connect(ctx.destination);
        var len = ctx.sampleRate * 2;
        var nb = ctx.createBuffer(1, len, ctx.sampleRate);
        var nd = nb.getChannelData(0);
        for (var i = 0; i < len; i++) { nd[i] = Math.random() * 2 - 1; }
        var loopNoise = function (type, freq, gain) {
          var s = ctx.createBufferSource();
          s.buffer = nb; s.loop = true;
          var f = ctx.createBiquadFilter();
          f.type = type; f.frequency.value = freq;
          var g = ctx.createGain();
          g.gain.value = gain;
          s.connect(f); f.connect(g); g.connect(out); s.start();
          return g;
        };
        var tone = function (freq, t, dur, vol) {
          var o = ctx.createOscillator();
          o.type = 'sine'; o.frequency.value = freq;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(out);
          o.start(t); o.stop(t + dur + 0.05);
        };
        var burst = function (t, freq, dur, vol) {
          var s = ctx.createBufferSource();
          s.buffer = nb;
          var f = ctx.createBiquadFilter();
          f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 3;
          var g = ctx.createGain();
          g.gain.setValueAtTime(vol, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          s.connect(f); f.connect(g); g.connect(out);
          s.start(t); s.stop(t + dur + 0.05);
        };
        var every = function (ms, fn) { fn(); timers.push(setInterval(fn, ms)); };

        if (kind === 'bell') {
          loopNoise('lowpass', 300, 0.02);
          every(7000, function () {
            var t = ctx.currentTime + 0.05;
            [392, 392 * 2.76, 392 * 5.4].forEach(function (f, i) { tone(f, t, 6 - i * 1.5, 0.12 / (i + 1)); });
          });
        } else if (kind === 'clop') {
          loopNoise('lowpass', 500, 0.025);
          every(3600, function () {
            var t = ctx.currentTime + 0.05;
            [0, 0.38, 0.76, 1.14, 1.52, 1.9].forEach(function (dt) {
              burst(t + dt, 1100, 0.09, 0.28);
              tone(130, t + dt, 0.14, 0.2);
            });
          });
        } else if (kind === 'sizzle') {
          loopNoise('highpass', 4000, 0.05);
          loopNoise('lowpass', 250, 0.02);
          every(250, function () {
            if (Math.random() < 0.5) { burst(ctx.currentTime + Math.random() * 0.2, 3000 + Math.random() * 3000, 0.03, 0.12); }
          });
        } else {
          var wg = loopNoise('lowpass', 600, 0.05);
          var lfo = ctx.createOscillator();
          lfo.frequency.value = 0.12;
          var lg = ctx.createGain();
          lg.gain.value = 0.03;
          lfo.connect(lg); lg.connect(wg.gain); lfo.start();
          every(8000, function () {
            var t = ctx.currentTime + 0.05;
            tone(1318, t, 3, 0.05);
            tone(1760, t + 0.4, 3, 0.04);
          });
        }
      }
      playing = true;
      btn.textContent = 'ปิดเสียง';
      btn.setAttribute('aria-pressed', 'true');
    } catch (e) { stop(); }
  }

  btn.addEventListener('click', function () { if (playing) { stop(); } else { start(); } });
  document.addEventListener('visibilitychange', function () { if (document.hidden && playing) { stop(); } });
})();
