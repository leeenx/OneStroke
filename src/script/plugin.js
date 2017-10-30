(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
	@ 一笔画插件
*/

var OneStrokePlugin = function () {
	function OneStrokePlugin() {
		_classCallCheck(this, OneStrokePlugin);
	}
	// 没什么事做 


	// 图片转换成对应格式


	_createClass(OneStrokePlugin, [{
		key: "parse",
		value: function parse(img, name) {
			var _this = this;

			return new Promise(function (resolve, reject) {
				_this.name = name;
				// 字符串
				if (typeof img === "string") {
					var src = img;
					img = new Image();
					img.crossOrigin = "*";
					img.src = src;
				}
				// 图片对象
				if (img instanceof Image === true) {
					// 已经加载完成
					if (img.complete === true) resolve(_this.scan(img));
					// 未加载完成等待
					else {
							img.onload = function () {
								return resolve(_this.scan(img));
							};
							img.onerror = function (err) {
								return reject(err);
							};
						}
				}
			});
		}

		/*
    @ 扫描识别线段 
    @ 考虑到图片可能来自截图，所以添加两个参数：head & foot 表示图像的头与尾的占位
  */

	}, {
		key: "scan",
		value: function scan(img) {
			var resolution = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 4;
			var head = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 120;
			var foot = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 120;

			head = head / resolution + 1 >> 0;foot = foot / resolution + 1 >> 0;
			// 颜色集
			var colors = new Map();
			var canvas = document.createElement("canvas");
			var ctx = canvas.getContext("2d");
			// 宽度是固定的750
			var width = 750;
			// img.with / width 的比率
			var ratio = width / img.width;
			// 高度计算
			var height = img.height * ratio;

			// 按分辨率压缩
			width = width / resolution >> 0;
			height = height / resolution >> 0;
			canvas.width = width;
			canvas.height = height;

			ctx.drawImage(img, 0, 0, width, height);

			// imageData
			var imageData = ctx.getImageData(0, 0, width, height);
			var data = imageData.data;

			// 起始索引
			var startIndex = head * width * 4;
			// 终点索引
			var endIndex = data.length - foot * width * 4;

			/*
     @ 收集颜色
     @ 扫描图像并收集图像的所有颜色
     @ 由于底色被认定为是白色或透明，所以白色和透明不收集
     @ 考虑到噪点对图像的影响，所以把接近白色的点也视作白色
   */
			// 线段颜色
			var lineColor = [0, 0, 0, 0, 0];

			// 端点颜色
			var vertexColor = [0, 0, 0, 0, 0];

			// 判断是否属于线段
			var isBelongLine = function isBelongLine(r, g, b, a) {
				return Math.abs(lineColor[0] - r) <= 10 && Math.abs(lineColor[1] - g) <= 10 && Math.abs(lineColor[2] - b) <= 10;
			};

			// 判断是否属于端点
			var isBelongVertex = function isBelongVertex(r, g, b, a) {
				return Math.abs(vertexColor[0] - r) <= 10 && Math.abs(vertexColor[1] - g) <= 10 && Math.abs(vertexColor[2] - b) <= 10;
			};

			// 判断是否属于底色
			var isBelongBackground = function isBelongBackground(r, g, b, a) {
				return 255 - r <= 20 && 255 - g <= 20 && 255 - b <= 20 && 255 - a <= 20;
			};

			// 扫描像素
			for (var i = startIndex; i < endIndex; i += 4) {
				var r = data[i],
				    g = data[i + 1],
				    b = data[i + 2],
				    a = data[i + 3];
				// 过滤白色/透明/接近白色
				if (a === 0 || isBelongBackground(r, g, b, a)) {
					continue;
				}
				var rgba = "rgba(" + r + "," + g + "," + b + "," + a + ")";
				if (colors.has(rgba) === true) {
					var color = colors.get(rgba);
					color[4]++;
				} else {
					colors.set(rgba, [r, g, b, a, 1]);
				}
			}

			// 颜色最多的是线段的颜色
			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = colors.values()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var _color = _step.value;

					var countA = _color[4],
					    countB = lineColor[4];
					if (countA > countB) lineColor = _color;
				}

				// 颜色第二多的是点的颜色
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}

			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = colors.values()[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var _color2 = _step2.value;
					var _ref2 = [_color2[0], _color2[1], _color2[2], _color2[3]],
					    _r3 = _ref2[0],
					    _g3 = _ref2[1],
					    _b3 = _ref2[2],
					    _a3 = _ref2[3];

					if (isBelongLine(_r3, _g3, _b3, _a3)) {
						continue;
					}
					var _countA = _color2[4],
					    _countB = vertexColor[4];
					if (_countA > _countB) vertexColor = _color2;
				}

				/*
      @ 收集图像中的端点
      @ 为了方便处理，把端点视作矩形（rect)
    */
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			var vertexes = [];
			var collect = function collect(index) {
				// 端点的边界 --- 用一个 rect 表示
				var top = index / (width * 4) + 1 >> 0,
				    right = index % (width * 4) / 4 >> 0,
				    bottom = top,
				    left = right;
				// RGBA
				var r = data[index],
				    g = data[index + 1],
				    b = data[index + 2],
				    a = data[index + 3];
				while (isBelongVertex(r, g, b, a)) {
					// 删除水平方向的点
					var boundary = clearHorizontal(index);
					left = Math.min(left, boundary.left);
					right = Math.max(right, boundary.right);
					// 点往下移动
					index += width * 4;
					r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3];
					// bottom 像素加1
					++bottom;
				}
				// 将点存入 vertexes
				vertexes.push({ top: top, right: right, bottom: bottom, left: left });
			};

			/*
     @ 清空指定点左右同色的像素
   */
			var clearHorizontal = function clearHorizontal(index) {
				// 左坐标
				var leftIndex = index - 4;
				// 向左
				while (isBelongVertex(data[leftIndex], data[leftIndex + 1], data[leftIndex + 2], data[leftIndex + 3])) {
					// 把 a 设置为 0 表示清除
					data[leftIndex + 3] = 0;
					// 向左移动
					leftIndex -= 4;
				}
				// 右坐标
				var rightIndex = index;
				// 向右
				while (isBelongVertex(data[rightIndex], data[rightIndex + 1], data[rightIndex + 2], data[rightIndex + 3])) {
					// 把 a 设置为 0 表示清除
					data[rightIndex + 3] = 0;
					// 向左移动
					rightIndex -= 4;
				}

				var left = leftIndex % (width * 4) / 4 >> 0,
				    right = rightIndex % (width * 4) / 4 >> 0;
				return { left: left, right: right };
			};

			// 矩形相交
			var isRectCross = function isRectCross(rectA, rectB) {
				var topA = rectA.top,
				    rightA = rectA.right,
				    bottomA = rectA.bottom,
				    leftA = rectA.left;
				var topB = rectB.top,
				    rightB = rectB.right,
				    bottomB = rectB.bottom,
				    leftB = rectB.left;
				// 判断垂直方向是否具备相交条件

				if (topA <= topB && bottomA >= topB || topB <= topA && bottomB >= topA) {
					// 判断水平方向是否具备相交条件
					if (leftA <= leftB && rightA >= leftB || leftB <= leftA && rightB >= leftA) {
						return true;
					}
				}
				return false;
			};

			// 合并矩形
			var mergeRect = function mergeRect(rectA, rectB) {
				return {
					top: Math.min(rectA.top, rectB.top),
					right: Math.max(rectA.right, rectB.right),
					bottom: Math.max(rectA.bottom, rectB.bottom),
					left: Math.min(rectA.left, rectB.left)
				};
			};

			// 扫描图像
			for (var _i = startIndex; _i < endIndex; _i += 4) {
				var _r = data[_i],
				    _g = data[_i + 1],
				    _b = data[_i + 2],
				    _a = data[_i + 3];
				// 过滤白色/透明/接近白色
				if (_a === 0 || isBelongBackground(_r, _g, _b, _a)) {
					continue;
				}
				// 遇到端点
				else if (isBelongVertex(_r, _g, _b, _a)) {
						// 收集端点
						collect(_i);
					}
			}

			// 由于噪点的影响 vertexes 并不精准，需要进行一次归并
			for (var _i2 = 0; _i2 < vertexes.length - 1; ++_i2) {
				var rectA = vertexes[_i2];
				// 跳过被删除的节点
				if (!rectA) continue;
				for (var j = 0; j < vertexes.length; ++j) {
					var rectB = vertexes[j];
					// 跳过被删除的节点
					if (_i2 === j || !rectB) continue;
					// 矩形相交
					if (isRectCross(rectA, rectB) === true) {
						// 合并矩形
						rectA = vertexes[_i2] = mergeRect(rectA, rectB);
						// 删除 rectB
						delete vertexes[j];
					}
				}
			}

			// 端点的中心坐标
			var coords = [];
			// 端点的半径
			var radius = 0;
			// 过滤空洞
			vertexes.forEach(function (rect) {
				var w = rect.right - rect.left,
				    h = rect.bottom - rect.top;
				// 半径取最大值
				radius = Math.max(radius, w / 2, h / 2) >> 0;
				coords.push([rect.left + w / 2 >> 0, rect.top + h / 2 >> 0]);
			});

			// 最终的线段
			var lines = [];

			/*
     @ 扫描两点之间是否存在线段
     @ 思路：均分断点
     @ AB间均分为 n 段，此时 A ---> B 之间均匀分布着 n - 1 个点
     @ 校验这n个点是否属于线段
   */

			for (var _i3 = 0, len = coords.length; _i3 < len - 1; ++_i3) {
				var aX = coords[_i3][0],
				    aY = coords[_i3][1];
				for (var _j = _i3 + 1; _j < len; ++_j) {
					var bX = coords[_j][0],
					    bY = coords[_j][1];
					// AB 的距离
					var distance = Math.sqrt(Math.pow(aX - bX, 2) + Math.pow(aY - bY, 2));
					// AB 均分为 n 个子线段，每个子线段的长度不得大于端点的直径，避免漏扫描
					var n = distance / (2 * radius) >> 0;
					// 子线段的步长（分X与Y）
					var stepX = (bX - aX) / n,
					    stepY = (bY - aY) / n;
					while (--n > 0) {
						var index = (aX + stepX * n >> 0) * 4 + (aY + stepY * n >> 0) * width * 4;
						var _ref = [data[index], data[index + 1], data[index + 2], data[index + 3]],
						    _r2 = _ref[0],
						    _g2 = _ref[1],
						    _b2 = _ref[2],
						    _a2 = _ref[3];
						// 断点没有落在线段上

						if (!isBelongLine(_r2, _g2, _b2, _a2)) break;
					}

					// 被检验的点都在线段上，表示 AB 成线
					if (0 === n) {
						// 还原尺寸
						lines.push({
							x1: coords[_i3][0] * resolution,
							y1: coords[_i3][1] * resolution,
							x2: coords[_j][0] * resolution,
							y2: coords[_j][1] * resolution
						});
					}
				}
			}

			// 删除对象
			canvas = colors = imageData = data = null;
			// return {vertexColor, lineColor, lines}; 
			// 端点颜色
			var baseVertexColor = vertexColor[0] * Math.pow(256, 2) + vertexColor[1] * Math.pow(256, 1) + vertexColor[2];
			// 线段颜色
			var baseLineColor = lineColor[0] * Math.pow(256, 2) + lineColor[1] * Math.pow(256, 1) + lineColor[2];
			// 手绘线的颜色取端点的半色值
			var strokeColor = vertexColor[0] * Math.pow(256, 2) / 2 + vertexColor[1] * Math.pow(256, 1) / 2 + vertexColor[2] / 2;

			return {
				lineColor: baseLineColor,
				vertexColor: baseVertexColor,
				strokeColor: strokeColor,
				activeVertexColor: baseVertexColor,
				lines: lines
			};
		}
	}]);

	return OneStrokePlugin;
}();

exports.default = OneStrokePlugin;

},{}],2:[function(require,module,exports){
"use strict";

var _OneStrokePlugin = require("./OneStrokePlugin.es6");

var _OneStrokePlugin2 = _interopRequireDefault(_OneStrokePlugin);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

window.OneStrokePlugin = _OneStrokePlugin2.default;

},{"./OneStrokePlugin.es6":1}]},{},[2]);
