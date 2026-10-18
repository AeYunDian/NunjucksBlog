/*!
 * aQuery.qrcode.js — 纯本地二维码生成（byte 模式，版本 1–10，L/M/Q/H）
 * 依赖：aquery.core.js、aquery.dom.js
 *
 * 用法：$a.qrcode("#box", "https://undz.cn/", { size: 200, level: "M", margin: 2 })
 */
(function (window, document, $a) {
  "use strict";

  /* ---------------- 常量 ---------------- */

  /* 纠错等级在「格式信息」里的编码：L=01, M=00, Q=11, H=10 */
  var LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /* RS 分块表：[总码字, 数据码字] 三元组；每个版本顺序为 L, M, Q, H */
  var RS_BLOCKS = [
    /* 1 */ [
      [1, 26, 19],
      [1, 26, 16],
      [1, 26, 13],
      [1, 26, 9],
    ],
    /* 2 */ [
      [1, 44, 34],
      [1, 44, 28],
      [1, 44, 22],
      [1, 44, 16],
    ],
    /* 3 */ [
      [1, 70, 55],
      [1, 70, 44],
      [2, 35, 17],
      [2, 35, 13],
    ],
    /* 4 */ [
      [1, 100, 80],
      [2, 50, 32],
      [2, 50, 24],
      [4, 25, 9],
    ],
    /* 5 */ [
      [1, 134, 108],
      [2, 67, 43],
      [2, 33, 15, 2, 34, 16],
      [2, 33, 11, 2, 34, 12],
    ],
    /* 6 */ [
      [2, 86, 68],
      [4, 43, 27],
      [4, 43, 19],
      [4, 43, 15],
    ],
    /* 7 */ [
      [2, 98, 78],
      [4, 49, 31],
      [2, 32, 14, 4, 33, 15],
      [4, 39, 13, 1, 40, 14],
    ],
    /* 8 */ [
      [2, 121, 97],
      [2, 60, 38, 2, 61, 39],
      [4, 40, 18, 2, 41, 19],
      [4, 40, 14, 2, 41, 15],
    ],
    /* 9 */ [
      [2, 146, 116],
      [3, 58, 36, 2, 59, 37],
      [4, 36, 16, 4, 37, 17],
      [4, 36, 12, 4, 37, 13],
    ],
    /* 10 */ [
      [2, 86, 68, 2, 87, 69],
      [4, 69, 43, 1, 70, 44],
      [6, 43, 19, 2, 44, 20],
      [6, 43, 15, 2, 44, 16],
    ],
  ];

  var ALIGN_POS = {
    1: [],
    2: [6, 18],
    3: [6, 22],
    4: [6, 26],
    5: [6, 30],
    6: [6, 34],
    7: [6, 22, 38],
    8: [6, 24, 42],
    9: [6, 26, 46],
    10: [6, 28, 50],
  };

  var G15 =
    (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | 1;
  var G18 =
    (1 << 12) |
    (1 << 11) |
    (1 << 10) |
    (1 << 9) |
    (1 << 8) |
    (1 << 5) |
    (1 << 2) |
    1;
  var G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);

  /* ---------------- GF(256) ---------------- */

  var EXP = [];
  var LOG = [];

  (function () {
    var i,
      x = 1;
    for (i = 0; i < 256; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
  })();

  function gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return EXP[n];
  }

  function glog(n) {
    if (n < 1) throw new Error("glog(" + n + ")");
    return LOG[n];
  }

  /* ---------------- 多项式 ---------------- */

  function Poly(num, shift) {
    var offset = 0;
    var i;

    while (offset < num.length && num[offset] === 0) offset++;

    this.num = [];
    for (i = 0; i < num.length - offset; i++) this.num.push(num[offset + i]);
    for (i = 0; i < (shift || 0); i++) this.num.push(0);
  }

  Poly.prototype.get = function (i) {
    return this.num[i] || 0;
  };

  Poly.prototype.len = function () {
    return this.num.length;
  };

  Poly.prototype.multiply = function (e) {
    var num = [];
    var i, j, a, b;

    if (!this.len() || !e.len()) return new Poly([], 0);

    for (i = 0; i < this.len() + e.len() - 1; i++) num.push(0);

    for (i = 0; i < this.len(); i++) {
      for (j = 0; j < e.len(); j++) {
        a = this.get(i);
        b = e.get(j);
        if (a && b) num[i + j] ^= gexp(glog(a) + glog(b));
      }
    }

    return new Poly(num, 0);
  };

  Poly.prototype.mod = function (e) {
    if (this.len() - e.len() < 0) return this;

    var ratio = glog(this.get(0)) - glog(e.get(0));
    var num = [];
    var i;

    for (i = 0; i < this.len(); i++) num.push(this.get(i));
    for (i = 0; i < e.len(); i++) {
      if (e.get(i)) num[i] ^= gexp(glog(e.get(i)) + ratio);
    }

    return new Poly(num, 0).mod(e);
  };

  function ecPoly(ecLength) {
    var a = new Poly([1], 0);
    for (var i = 0; i < ecLength; i++)
      a = a.multiply(new Poly([1, gexp(i)], 0));
    return a;
  }

  /* ---------------- 位缓冲 ---------------- */

  function BitBuffer() {
    this.buffer = [];
    this.length = 0;
  }

  BitBuffer.prototype.put = function (num, length) {
    for (var i = 0; i < length; i++) {
      this.putBit(((num >>> (length - i - 1)) & 1) === 1);
    }
  };

  BitBuffer.prototype.putBit = function (bit) {
    var index = Math.floor(this.length / 8);
    if (this.buffer.length <= index) this.buffer.push(0);
    if (bit) this.buffer[index] |= 0x80 >>> (this.length % 8);
    this.length++;
  };

  /* ---------------- 编码 ---------------- */

  function utf8Bytes(str) {
    var out = [],
      i,
      c,
      c2,
      cp;

    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);

      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff) {
        c2 = str.charCodeAt(++i);
        cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(
          0xf0 | (cp >> 18),
          0x80 | ((cp >> 12) & 0x3f),
          0x80 | ((cp >> 6) & 0x3f),
          0x80 | (cp & 0x3f),
        );
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }

    return out;
  }

  function getRSBlocks(version, levelIndex) {
    var table = RS_BLOCKS[version - 1][levelIndex];
    var list = [],
      i,
      j;

    for (i = 0; i < table.length; i += 3) {
      for (j = 0; j < table[i]; j++) {
        list.push({ totalCount: table[i + 1], dataCount: table[i + 2] });
      }
    }

    return list;
  }

  function totalDataCount(version, levelIndex) {
    var blocks = getRSBlocks(version, levelIndex);
    var sum = 0;
    for (var i = 0; i < blocks.length; i++) sum += blocks[i].dataCount;
    return sum;
  }

  function createData(version, levelIndex, bytes) {
    var blocks = getRSBlocks(version, levelIndex);
    var buffer = new BitBuffer();
    var lengthBits = version < 10 ? 8 : 16;
    var total = totalDataCount(version, levelIndex);
    var i;

    buffer.put(4, 4); /* byte mode */
    buffer.put(bytes.length, lengthBits);
    for (i = 0; i < bytes.length; i++) buffer.put(bytes[i], 8);

    if (buffer.length > total * 8) throw new Error("内容过长");

    if (buffer.length + 4 <= total * 8) buffer.put(0, 4);
    while (buffer.length % 8 !== 0) buffer.putBit(false);

    while (true) {
      if (buffer.length >= total * 8) break;
      buffer.put(0xec, 8);
      if (buffer.length >= total * 8) break;
      buffer.put(0x11, 8);
    }

    return createBytes(buffer, blocks);
  }

  function createBytes(buffer, blocks) {
    var offset = 0;
    var dcData = [],
      ecData = [];
    var maxDc = 0,
      maxEc = 0;
    var i, j, r;

    for (i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      var dcCount = block.dataCount;
      var ecCount = block.totalCount - block.dataCount;
      var dc = [];

      for (j = 0; j < dcCount; j++) dc.push(buffer.buffer[offset + j] & 0xff);
      offset += dcCount;

      var poly = new Poly(dc, ecPoly(ecCount).len() - 1).mod(ecPoly(ecCount));
      var ec = [];

      for (j = 0; j < ecCount; j++) {
        var index = j + poly.len() - ecCount;
        ec.push(index >= 0 ? poly.get(index) : 0);
      }

      dcData.push(dc);
      ecData.push(ec);
      maxDc = Math.max(maxDc, dcCount);
      maxEc = Math.max(maxEc, ecCount);
    }

    var out = [];
    var k = 0;

    for (i = 0; i < maxDc; i++) {
      for (r = 0; r < blocks.length; r++) {
        if (i < dcData[r].length) out[k++] = dcData[r][i];
      }
    }
    for (i = 0; i < maxEc; i++) {
      for (r = 0; r < blocks.length; r++) {
        if (i < ecData[r].length) out[k++] = ecData[r][i];
      }
    }

    return out;
  }

  /* ---------------- BCH ---------------- */

  function bchDigit(data) {
    var d = 0;
    while (data !== 0) {
      d++;
      data >>>= 1;
    }
    return d;
  }

  function bchTypeInfo(data) {
    var d = data << 10;
    while (bchDigit(d) - bchDigit(G15) >= 0)
      d ^= G15 << (bchDigit(d) - bchDigit(G15));
    return ((data << 10) | d) ^ G15_MASK;
  }

  function bchTypeNumber(data) {
    var d = data << 12;
    while (bchDigit(d) - bchDigit(G18) >= 0)
      d ^= G18 << (bchDigit(d) - bchDigit(G18));
    return (data << 12) | d;
  }

  /* ---------------- 矩阵 ---------------- */

  function maskBit(mask, i, j) {
    switch (mask) {
      case 0:
        return (i + j) % 2 === 0;
      case 1:
        return i % 2 === 0;
      case 2:
        return j % 3 === 0;
      case 3:
        return (i + j) % 3 === 0;
      case 4:
        return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5:
        return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6:
        return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      default:
        return (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
    }
  }

  function setupFinder(modules, size, row, col) {
    var r, c;

    for (r = -1; r <= 7; r++) {
      if (row + r <= -1 || size <= row + r) continue;
      for (c = -1; c <= 7; c++) {
        if (col + c <= -1 || size <= col + c) continue;
        modules[row + r][col + c] =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
    }
  }

  function setupAlign(modules, row, col) {
    for (var r = -2; r <= 2; r++) {
      for (var c = -2; c <= 2; c++) {
        modules[row + r][col + c] =
          r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0);
      }
    }
  }

  function setupTypeInfo(modules, size, levelBits, mask) {
    var bits = bchTypeInfo((levelBits << 3) | mask);
    var i, mod;

    for (i = 0; i < 15; i++) {
      mod = ((bits >> i) & 1) === 1;
      if (i < 6) modules[i][8] = mod;
      else if (i < 8) modules[i + 1][8] = mod;
      else modules[size - 15 + i][8] = mod;
    }

    for (i = 0; i < 15; i++) {
      mod = ((bits >> i) & 1) === 1;
      if (i < 8) modules[8][size - i - 1] = mod;
      else if (i < 9) modules[8][15 - i] = mod;
      else modules[8][15 - i - 1] = mod;
    }

    modules[size - 8][8] = true;
  }

  function setupTypeNumber(modules, size, version) {
    var bits = bchTypeNumber(version);
    var i, mod;

    for (i = 0; i < 18; i++) {
      mod = ((bits >> i) & 1) === 1;
      modules[Math.floor(i / 3)][(i % 3) + size - 11] = mod;
    }
    for (i = 0; i < 18; i++) {
      mod = ((bits >> i) & 1) === 1;
      modules[(i % 3) + size - 11][Math.floor(i / 3)] = mod;
    }
  }

  function mapData(modules, size, data, mask) {
    var inc = -1;
    var row = size - 1;
    var bitIndex = 7;
    var byteIndex = 0;
    var col, c, dark;

    for (col = size - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;

      while (true) {
        for (c = 0; c < 2; c++) {
          if (modules[row][col - c] === null) {
            dark =
              byteIndex < data.length
                ? ((data[byteIndex] >>> bitIndex) & 1) === 1
                : false;

            if (maskBit(mask, row, col - c)) dark = !dark;

            modules[row][col - c] = dark;

            bitIndex--;
            if (bitIndex === -1) {
              byteIndex++;
              bitIndex = 7;
            }
          }
        }

        row += inc;
        if (row < 0 || size <= row) {
          row -= inc;
          inc = -inc;
          break;
        }
      }
    }
  }

  function makeImpl(version, data, levelBits, mask) {
    var size = version * 4 + 17;
    var modules = [];
    var r, c, pos, row, col;

    for (r = 0; r < size; r++) {
      modules[r] = [];
      for (c = 0; c < size; c++) modules[r][c] = null;
    }

    setupFinder(modules, size, 0, 0);
    setupFinder(modules, size, size - 7, 0);
    setupFinder(modules, size, 0, size - 7);

    pos = ALIGN_POS[version] || [];
    for (r = 0; r < pos.length; r++) {
      for (c = 0; c < pos.length; c++) {
        row = pos[r];
        col = pos[c];
        if (modules[row][col] !== null) continue;
        setupAlign(modules, row, col);
      }
    }

    for (r = 8; r < size - 8; r++) {
      if (modules[r][6] === null) modules[r][6] = r % 2 === 0;
    }
    for (c = 8; c < size - 8; c++) {
      if (modules[6][c] === null) modules[6][c] = c % 2 === 0;
    }

    setupTypeInfo(modules, size, levelBits, mask);
    if (version >= 7) setupTypeNumber(modules, size, version);

    mapData(modules, size, data, mask);

    return modules;
  }

  /* ---------------- 掩码评分 ---------------- */

  function countIn(str, sub) {
    var n = 0,
      i = 0;
    while ((i = str.indexOf(sub, i)) > -1) {
      n++;
      i++;
    }
    return n;
  }

  function penalty(modules, size) {
    var score = 0;
    var r, c, run, dark, line, v;

    /* 规则 1：行 / 列连续同色 >= 5 */
    for (r = 0; r < size; r++) {
      run = 1;
      dark = modules[r][0];
      for (c = 1; c < size; c++) {
        if (modules[r][c] === dark) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
          dark = modules[r][c];
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }

    for (c = 0; c < size; c++) {
      run = 1;
      dark = modules[0][c];
      for (r = 1; r < size; r++) {
        if (modules[r][c] === dark) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
          dark = modules[r][c];
        }
      }
      if (run >= 5) score += 3 + (run - 5);
    }

    /* 规则 2：2x2 同色块 */
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        v = modules[r][c];
        if (
          v === modules[r][c + 1] &&
          v === modules[r + 1][c] &&
          v === modules[r + 1][c + 1]
        ) {
          score += 3;
        }
      }
    }

    /* 规则 3：1:1:3:1:1 模式（含 4 个浅色边） */
    for (r = 0; r < size; r++) {
      line = "";
      for (c = 0; c < size; c++) line += modules[r][c] ? "1" : "0";
      score += countIn(line, "10111010000") * 40;
      score += countIn(line, "00001011101") * 40;
    }

    for (c = 0; c < size; c++) {
      line = "";
      for (r = 0; r < size; r++) line += modules[r][c] ? "1" : "0";
      score += countIn(line, "10111010000") * 40;
      score += countIn(line, "00001011101") * 40;
    }

    /* 规则 4：暗色比例 */
    dark = 0;
    for (r = 0; r < size; r++) {
      for (c = 0; c < size; c++) if (modules[r][c]) dark++;
    }
    var ratio = Math.abs((100 * dark) / (size * size) - 50) / 5;
    score += Math.floor(ratio) * 10;

    return score;
  }

  /* ---------------- 对外：编码 ---------------- */

  function encode(text, levelName) {
    var level = String(levelName || "M").toUpperCase();
    if (!LEVEL_BITS.hasOwnProperty(level)) level = "M";

    var levelIndex = { L: 0, M: 1, Q: 2, H: 3 }[level];
    var bytes = utf8Bytes(String(text));
    var version = 0;
    var i, need;

    for (i = 1; i <= 10; i++) {
      need = 4 + (i < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= totalDataCount(i, levelIndex) * 8) {
        version = i;
        break;
      }
    }

    if (!version) throw new Error("内容过长，无法生成二维码");

    var data = createData(version, levelIndex, bytes);
    var best = null,
      bestScore = Infinity,
      bestMask = 0;

    for (i = 0; i < 8; i++) {
      var modules = makeImpl(version, data, LEVEL_BITS[level], i);
      var s = penalty(modules, version * 4 + 17);
      if (s < bestScore) {
        bestScore = s;
        best = modules;
        bestMask = i;
      }
    }

    return {
      size: version * 4 + 17,
      modules: best,
      version: version,
      mask: bestMask,
      level: level,
      score: bestScore,
    };
  }

  /* ---------------- 对外：绘制 ---------------- */

  function draw(target, qr, options) {
    var opts = options || {};
    var margin = opts.margin == null ? 4 : opts.margin;
    var size = opts.size || 200;
    var bg = opts.background || "#ffffff";
    var fg = opts.color || "#000000";
    var $target = $a(target);
    var count = qr.size + margin * 2;
    var r, c, cell;

    $target.empty();

    /* 有 canvas 就画 canvas（渲染方式由调用方通过 render 决定） */
    if (opts.render !== "table") {
      var canvas = document.createElement("canvas");
      var ctx = canvas.getContext && canvas.getContext("2d");

      if (ctx) {
        cell = Math.max(1, Math.floor(size / count));
        canvas.width = count * cell;
        canvas.height = count * cell;
        canvas.style.width = size + "px";
        canvas.style.height = size + "px";

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = fg;

        for (r = 0; r < qr.size; r++) {
          for (c = 0; c < qr.size; c++) {
            if (qr.modules[r][c]) {
              ctx.fillRect(
                (c + margin) * cell,
                (r + margin) * cell,
                cell,
                cell,
              );
            }
          }
        }

        $target.append(canvas);
        return canvas;
      }
    }

    /* 退路：表格 */
    cell = Math.max(2, Math.floor(size / count));

    var html =
      '<table role="img" aria-label="二维码" style="border-collapse:collapse;background:' +
      bg +
      '">';

    for (r = 0; r < count; r++) {
      html += "<tr>";
      for (c = 0; c < count; c++) {
        var dark =
          r >= margin &&
          r < margin + qr.size &&
          c >= margin &&
          c < margin + qr.size &&
          qr.modules[r - margin][c - margin];

        html +=
          '<td style="width:' +
          cell +
          "px;height:" +
          cell +
          "px;background:" +
          (dark ? fg : bg) +
          '"></td>';
      }
      html += "</tr>";
    }

    html += "</table>";
    $target.html(html);

    return $target.find("table")[0];
  }

  /* ---------------- 导出 ---------------- */

  $a.qrcode = function (target, text, options) {
    var qr;

    try {
      qr = encode(text, (options && options.level) || "M");
    } catch (e) {
      $a(target).html(
        '<p class="qrcode__error">' + (e.message || "二维码生成失败") + "</p>",
      );
      return null;
    }

    return draw(target, qr, options);
  };

  /* 只要矩阵（调试/测试用） */
  $a.qrcode.matrix = function (text, level) {
    return encode(text, level);
  };

  $a.qrcode.version = "0.1.0";
})(window, document, window.$a);
