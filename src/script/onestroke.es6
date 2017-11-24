// 向前兼容
import 'babel-polyfill'; 

// PIXI 工具
import './lib/utils.es6'; 

// 识图插件
import oneStrokePlugin from './oneStrokePlugin.es6'; 

// 事件
import Events from './lib/Events'; 

// 一笔画
class OneStroke {
	constructor(config) {
		const app = new PIXI.Application(
			{
				width: 375, 
				height: 603, 
				resolution: 2, 
				antialias: true, 
				transparent: true, 
				view: document.getElementById("easel")
			}
		); 

		[this.app, this.stage, this.renderer, this.view] = [app, app.stage, app.renderer, app.renderer.view]; 

		// config 挂载到 this
		this.config = config; 

		// 当前关数
		this.curLevel = 0; 

		// 总关数
		this.total = config.levels.length; 

		// 当前线段
		this.lines = []; 

		// 底图线段
		this.baseLines = []; 

		// 手绘的线段
		this.strokes = []; 

		// 回收站 ----- 用于存储待回退的线段与坐标
		this.recycler = []; 

		// 底图端点
		this.baseVertexes = []; 

		// 当前的端点坐标集合
		this.coords = []; 

		// 当前有效的可连接点
		this.curValidCoords = []; 

		// 已连接的线段快照 ------ 用于快速查找两点之间是否已经连接过
		this.strokedSnap = {}; 

		// 默认的线段颜色
		this.lineColor = config.lineColor; 

		// 默认的端点颜色
		this.vertexColor = config.vertexColor; 

		// 激活的端点颜色
		this.activeVertexColor = config.activeVertexColor

		// 绘制中的线段颜色
		this.strokeColor = config.strokeColor; 

		// 端点半径
		this.vertexRadius = 9; 

		// 线段的厚度
		this.lineWidth = 10; 

		// 当前点
		this.curVertex = null; 

		// 当前坐标信息
		this.curCoord = null; 

		// 当前线段
		this.curStroke = null; 

		// 当前的有效点
		this.validCoords = []; 

		//  当前屏幕width 与 ip6.width 的比例
		this.ratio = 375 / document.body.clientWidth; 

		// view 左边界距离视窗左边界的距离
		this.viewLeft = 0; 

		// 当前手指信息
		this.finger = {}; 

		// 默认不可以绘制
		this.canStroke = false; 

		// 实例插件
		this.plugin = new oneStrokePlugin(); 

		// 事件绑定 
		this.event = new Events(); 

		// 事件绑定 this
		this.touchstartHandle = this.touchstartHandle.bind(this); 
		this.touchmoveHandle = this.touchmoveHandle.bind(this); 
		this.touchendHandle = this.touchendHandle.bind(this); 
		this.touchcancelHandle = this.touchendHandle; 

		// 兼容非移动端
		if("ontouchstart" in document) { 
			this.touchstart = "touchstart"; 
			this.touchmove = "touchmove"; 
			this.touchend = "touchend"; 
			this.touchcancel = "touchcancel"; 
		}
		// 没有 touch 事件
		else { 
			this.touchstart = "mousedown"; 
			this.touchmove = "mousemove"; 
			this.touchend = "mouseup"; 
			// 并没有 mousecancel
			this.touchcancel = "mousecancle"; 
		}
		// 初始化
		this.init(); 
	} 

	// 初始化
	init() {
		// 添加手指事件
		this.view.addEventListener(this.touchstart, this.touchstartHandle); 
		this.view.addEventListener(this.touchmove, this.touchmoveHandle); 
		this.view.addEventListener(this.touchend, this.touchendHandle); 
		this.view.addEventListener(this.touchcancel, this.touchendHandle); 
	}

	// 开始游戏
	start() {
		// 默认进入第一关
		this.enter(0); 
	}

	// 重新开始 
	restart() { 
		// 重新进入当前关卡
		this.enter(this.curLevel); 
	}

	// 销毁
	destory() {
		this.view.removeEventListener("touchstart", this.touchstartHandle); 
		this.view.removeEventListener("touchmove", this.touchmoveHandle); 
		this.view.removeEventListener("touchend", this.touchendHandle); 
		this.view.removeEventListener("touchcancel", this.touchendHandle); 
		// 清空动画与节点
		this.clean(); 
	}

	// 暂停
	pause() {
		this.app.ticker.stop(); 
		TweenMax.pauseAll(); 
	}
	// 恢复
	resume() {
		this.app.ticker.start(); 
		TweenMax.resumeAll(); 
	}

	// gameover
	gameover() {
		this.event.dispatch("gameover"); 
	}

	// 清空
	clean() {
		// 清空节点
		this.stage.removeChildren(); 
		// 清空坐标组
		this.coords.length = 0; 
		// 清除当前端点与线段
		this.curStroke = this.curVertex = this.curCoord = null; 
		// 清空快照
		this.strokedSnap = {}; 
		// 清空手绘线
		this.strokes.length = 0; 
		// 清空回收站
		this.recycler.length = 0; 
		// 清空动画
		TweenMax.killAll(); 
		// 解除锁定
		this.lock = false; 
		// 默认不可以绘制
		this.canStroke = false; 
	}

	// 进入对应的关卡
	enter(index) {
		// 清空当前关卡的图形
		this.clean(); 
		let curLevel = this.config.levels[index]; 

		// 当前关卡数
		this.curLevel = index; 

		// 当前是图片路径
		if(curLevel.lines === undefined && curLevel.src != undefined) { 
			// 通知外部关卡载入中
			this.event.dispatch("level-loading"); 
			let name = curLevel.name; 
			this.plugin.parse(curLevel.src)
				.then(curLevel => { 
					curLevel.name = name; 
					this.event.dispatch("level-loaded"); 
					this.drawLevel(curLevel); 
				})
				.catch(err => console.log("图片载入失败"))
		}
		// 当前是关卡对象
		else {
			this.drawLevel(curLevel); 
		}	
		
	}

	// 绘制当前关卡
	drawLevel(curLevel) {
		// 当前线段 ---- 拷贝config中的信息
		this.lines = curLevel.lines.map(item => { 
			let newItem = Object.create(item); 
			return newItem; 
		}); 

		// 底图端点的颜色
		this.vertexColor = curLevel.vertexColor || config.vertexColor; 

		// 手绘线段的颜色
		this.strokeColor = curLevel.strokeColor || this.strokeColor; 

		// 激活点的颜色
		this.activeVertexColor = curLevel.activeVertexColor || this.activeVertexColor; 

		// PIXI 的分辨率
		let resolution = this.renderer.resolution; 

		// 收集当前端点 
		this.lines.forEach((item) => { 
			["x1", "y1", "x2", "y2"].forEach((key) => item[key] = item[key] / resolution); 
			let {x1, y1, x2, y2} = item; 
			this.addCoords({x: x1, y: y1}, {x: x2, y: y2}); 
		}); 

		// 找出坐标对应的有效连接点
		this.findValidCoords(); 

		// 绘制底图线段
		this.drawBaseLines(); 

		// 绘制底图端点
		this.drawBaseVertexes(); 

		// 更新当前有效点（坐标）
		this.updateValidCoords(); 

		// 通知游戏开始
		this.event.dispatch("start", curLevel); 
	}

	// 向 coords 添加端点
	addCoords(...coords) {
		coords.forEach(({x, y}) => {
			for(let i = 0, len = this.coords.length; i < len; ++i) {
				if(this.coords[i].x === x && this.coords[i].y === y) {
					return false; 
				}
			} 
			this.coords.push({x, y})
		});
	}

	// 绘制底图线段
	drawBaseLines() {
		this.baseLines = this.lines.map(
			({x1, y1, x2, y2}) => { 
				let line = new PIXI.Graphics()
					.lineStyle(this.lineWidth, this.lineColor, 1)
						.moveTo(x1, y1)
							.lineTo(x2, y2)
								.closePath(); 
				this.stage.addChild(line); 
				return line;
			}
		); 
	}

	// 绘制底图端点
	drawBaseVertexes() {
		this.baseVertexes = this.coords.map(
			({x, y}) => {
				let vertex = new PIXI.Graphics()
					.beginFill(this.vertexColor, 1)
						.drawCircle(0, 0, this.vertexRadius);

				vertex.set({x: x, y: y}); 
				this.stage.addChild(vertex); 
				return vertex;  
			}
		); 
	}

	// touchstart
	touchstartHandle(e) { 
		if(this.lock === true) return ; 
		// 移动端
		if(this.touchstart === "touchstart") {
			var {pageX: x, pageY: y} = e.targetTouches[0]; 
		}
		// 非移动端
		else {
			var {clientX: x, clientY: y} = e; 
		}

		// 修正 x
		x -= this.viewLeft; 
		
		x *= this.ratio; 
		y *= this.ratio; 
		this.finger.x = x, this.finger.y = y; 
		// 表示图形画了一半，继续画
		if(this.curStroke !== null) { 
			this.updateLine(x, y); 
			this.canStroke = true; 
		} 
		// 表示图形第一次绘制
		else {
			let coord = this.check(x, y); 
			// 手指下没有端点
			if(coord === false) this.canStroke = false; 
			// 手指下有端点
			else {
				this.canStroke = true; 
				// 生成新位置的激活点
				this.addActiveVertex(coord); 
				// 创建一条长度为0的手绘线段
				this.generateStroke(coord); 
			}
		}
	}
	// touchmove
	touchmoveHandle(e) { 
		// 不能画线
		if(this.canStroke === false || this.lock === true) return ; 
		// 移动端
		if(this.touchstart === "touchstart") {
			var {pageX: x, pageY: y} = e.targetTouches[0]; 
		}
		// 非移动端
		else {
			var {clientX: x, clientY: y} = e; 
		}
		// 修正 x
		x -= this.viewLeft; 

		x *= this.ratio; 
		y *= this.ratio; 
		this.updateLine(x, y); 
	}
	// touchend
	touchendHandle(e) { 
		// 不能画线
		if(this.canStroke === false || this.lock === true) return ; 
		// 没有成形的手绘线
		if(this.strokes.length === 1) { 
			// 移除当前激活点
			this.removeActiveVertex(); 
			// 删除当前 stroke
			this.stage.removeChild(this.curStroke); 
			this.curStroke = null; 
			// strokes 清零
			this.strokes.length = 0; 
			// recycler 清空
			this.recycler.length = 0; 
			// 更新有效点
			this.updateValidCoords(); 
		}
		// 有成形的手绘线 ---- 将未成形的线段回退到起始点
		else {
			let points = this.curStroke.graphicsData[0].shape.points; 
			points[2] = points[0]; 
			points[3] = points[1]; 
			this.curStroke.dirty++ & this.curStroke.clearDirty++; 
		}
		// 重置为不可绘制
		this.canStroke = false; 
	}

	// 找出坐标对应的有效连接点
	findValidCoords() { 
		this.coords.forEach(coord => { 
			// 创建一个有效坐标数组 
			coord.validCoords = []; 
			this.lines.forEach(({x1, y1, x2, y2}) => {
				// 坐标是当前线段的起点
				if(coord.x === x1 && coord.y === y1) {
					coord.validCoords.push(this.findCoord(x2, y2)); 
				}
				// 坐标是当前线段的终点
				else if(coord.x === x2 && coord.y === y2) {
					coord.validCoords.push(this.findCoord(x1, y1)); 
				}
			})
		}); 
	}

	// 返回对应的坐标点 
	findCoord(x, y) { 
		for(let coord of this.coords) {
			if(coord.x === x && coord.y === y) return coord; 
		}
		return false; 
	}

	// 更新当前的有效点
	updateValidCoords(coord) { 
		// 默认是当前所有坐标 
		if(coord === undefined) {
			this.validCoords = this.coords; 
		}
		// 剔除 coord.validCoords 中无效的坐标
		else {
			for(let i = 0; i < coord.validCoords.length; ++i) {
				let validCoord = coord.validCoords[i]; 
				let snapKey = "stroke_from_x_" + validCoord.x + "_y_" + validCoord.y + "_to_x_" + coord.x + "_y_" + coord.y; 
				// 标记当前点与当前有效点已经连线
				if(this.strokedSnap[snapKey] === true) {
					coord.validCoords[i].connected = true; 
				}
				// 标记未链接
				else {
					coord.validCoords[i].connected = false; 
				}
			}
			this.validCoords = coord.validCoords; 
		}
		this.validCoords = coord !== undefined ? coord.validCoords : this.coords; 
	}

	// 更新当前线段
	updateLine(x = this.finger.x, y = this.finger.y) { 
		let coord = this.check(x, y), 
			points = this.curStroke.graphicsData[0].shape.points; 
		// 手指下不存在有效点
		if(coord === false) {
			points[2] = x; 
			points[3] = y; 
		}
		// 手批下是有效点
		else if(coord !== this.curCoord){
			// 两点成线
			points[2] = coord.x; 
			points[3] = coord.y; 
			// 从 this.lines 中删除这条线段
			for(let i = 0, len = this.lines.length; i < len; ++i) {
				let {x1, y1, x2, y2, isDeleted} = this.lines[i]; 
				// 跳过已经标记删除的线段
				if(isDeleted === true) continue; 
				// 手指下的当前点
				let {x: x3, y: y3} = coord; 
				// 当前线段的起始点
				let {x: x4, y: y4} = this.curCoord; 
				if(
					x1 === x3 && y1 === y3 && x2 === x4 && y2 === y4
					||
					x1 === x4 && y1 === y4 && x2 === x3 && y2 === y3
				) {
					// 标记删除 
					this.lines[i].isDeleted = true; 
					// 把线段与坐标回收
					this.recycler[this.recycler.length] = {line: this.lines[i], curCoord: this.curCoord}; 
					// this.lines.splice(i, 1); 
					break; 
				}
			}

			// 未通关，生成新的线段
			if(this.lines.length > this.strokes.length) { 
				// 将已经完成的线段存入快照
				let snapKeyA = "stroke_from_x_" + this.curCoord.x + "_y_" + this.curCoord.y + "_to_x_" + coord.x + "_y_" + coord.y; 
				let snapKeyB = "stroke_from_x_" + coord.x + "_y_" + coord.y + "_to_x_" + this.curCoord.x + "_y_" + this.curCoord.y; 
				this.strokedSnap[snapKeyA] = this.strokedSnap[snapKeyB] = true; 
				// 将删除的线段
				// 删除上一次的激活点
				this.removeActiveVertex(); 
				// 生成新位置的激活点
				this.addActiveVertex(coord); 
				// 创建新线段后 curStroke 指向会变，所以提前更新
				this.curStroke.dirty++ & this.curStroke.clearDirty ++; 
				// 创建一条长度为0的手绘线段
				this.generateStroke(coord); 
			}
			// 通关 ----- 手绘线的数量与待画线相等
			else {
				// 删除上一次的激活点
				this.removeActiveVertex(); 
				// 锁定
				this.lock = true; 
				this.pass(); 
			} 
		}
		this.curStroke.dirty++ & this.curStroke.clearDirty ++; 
	}

	// 创建一条长度为0的手绘线段
	generateStroke(coord) { 
		let {x, y} = coord; 
		this.curStroke = new PIXI.Graphics()
			.lineStyle(this.lineWidth, this.strokeColor, 1)
				.moveTo(x, y)
					.lineTo(x, y)
						.closePath(); 
		this.strokes.push(this.curStroke); 
		// 添加到舞台
		this.stage.addChild(this.curStroke); 
		// 设置层级
		this.stage.setChildIndex(this.curStroke, this.baseLines.length); 
		// 更新有效连接点
		this.updateValidCoords(coord); 
	}

	// 监测手指下是否有端点
	check(x0, y0) { 
		for(let i = 0, len = this.validCoords.length; i < len; ++i) {
			let {x, y, connected} = this.validCoords[i]; 
			// 跳过已连结的端点
			if(connected === true) continue; 
			let distance = Math.sqrt(Math.pow(x - x0, 2) + Math.pow(y - y0, 2)); 
			// 手指在半径内 ------ 移动端适当把半径放大
			if(distance <= this.vertexRadius * 1.5) { 
				return this.validCoords[i]; 
			}
		}
		return false; 
	}
	// 激活的点 ----- 鼠标点击时的动画或关卡过关时的动画
	addActiveVertex(coord) { 
		let vertex = new PIXI.Graphics()
					.beginFill(this.activeVertexColor, 1)
						.drawCircle(0, 0, this.vertexRadius);
		let {x, y} = coord; 
		vertex.set({x: x, y: y}); 
		// 添加到舞台
		this.stage.addChild(vertex); 
		// 当前端点
		this.curVertex = vertex; 
		// 当前坐标信息
		this.curCoord = coord; 
		// 添加动画
		TweenMax.to(vertex, .2, {alpha: .4, scaleX: 1.6, scaleY: 1.6, yoyo: true, repeat: -1}); 
	}
	// 移除激活点
	removeActiveVertex() { 
		this.stage.removeChild(this.curVertex); 
		TweenMax.killTweensOf(this.curVertex); 
	}
	// 后退一步
	rollback() { 
		// 回收器有东西并且不止一条记录
		if(this.recycler.length > 1) { 
			let recyclerInfo = this.recycler.pop(); 
			// 删除快照
			let snapKeyA = "stroke_from_x_" + this.curCoord.x + "_y_" + this.curCoord.y + "_to_x_" + recyclerInfo.curCoord.x + "_y_" + recyclerInfo.curCoord.y; 
			let snapKeyB = "stroke_from_x_" + recyclerInfo.curCoord.x + "_y_" + recyclerInfo.curCoord.y + "_to_x_" + this.curCoord.x + "_y_" + this.curCoord.y; 
			this.strokedSnap[snapKeyA] = this.strokedSnap[snapKeyB] = false; 
			// 移除当前激活点
			this.removeActiveVertex(); 
			// 重新设置激活点
			this.addActiveVertex(recyclerInfo.curCoord); 
			// 标记线段未删除
			recyclerInfo.line.isDeleted = false; 
			
			// 移除当前的手绘线
			let lastStroke = this.strokes.pop(); 
			this.stage.removeChild(lastStroke); 
			// 重新指定当前手绘线
			this.curStroke = this.strokes[this.strokes.length - 1]; 
			// 线段回退到原点
			let points = this.curStroke.graphicsData[0].shape.points; 
			points[2] = points[0]; 
			points[3] = points[1]; 
			this.curStroke.dirty++ & this.curStroke.clearDirty++; 
			// 更新有效连接坐标
			this.updateValidCoords(this.curCoord); 
		}
		// 回收器里只有一条记录
		else if(this.recycler.length === 1) {
			// 直接调用重新开始游戏
			this.restart(); 
		}
	}
	// 通关
	pass() { 
		// 清除所有的底图基点
		this.baseVertexes.forEach(vertex => TweenMax.to(vertex, 1, {scaleX: 2.5, scaleY: 2.5, alpha: 0})); 
		// 清空所有的底图线段
		this.baseLines.forEach(line => this.stage.removeChild(line)); 
		// 敲落手绘线
		this.knockStrokes(() => this.event.dispatch("pass")); 
	}
	// 下一关
	next() { 
		console.log(this.curLevel, this.config.levels.length - 1); 
		if(this.curLevel < this.config.levels.length - 1) {
			this.enter(this.curLevel + 1); 
		}
		else {
			this.gameover(); 
		}
	}
	// 上一关
	prev() {
		if(this.curLevel > 0) {
			this.enter(this.curLevel - 1); 
		}
	}
	// 敲落手绘线段
	knockStrokes(cb) {
		// promises
		let promises = this.strokes.map(stroke => new Promise(
			(resolve, reject) => { 
				// 设置中心点
				let {width, height, left, top} = stroke.getBounds(); 
				stroke.set({pivotX: left + width / 2, pivotY: top + height / 2, x: stroke.x + left + width / 2, y: stroke.y + top + height / 2}); 
				TweenMax.to(stroke, Math.random() * .8 + 1.5, { 
						delay: Math.random() * .5, 
						rotation: Math.PI, 
						y: this.view.height * 1.5, 
						onComplete: () => resolve()
					}
				)
			}
		)); 
		Promise.race(promises).then(() => cb())
	}
}

window.OneStroke = OneStroke; 
// 屏蔽pixijs信息
PIXI.utils.skipHello(); 