/*
	@ 一笔画插件
*/

export default class OneStrokePlugin {
	constructor() {
		// 没什么事做 
	}

	// 图片转换成对应格式
	parse(img, name) { 
		return new Promise((resolve, reject) => { 
			this.name = name; 
			// 字符串
			if(typeof(img) === "string") {
				let src = img; 
				img = new Image(); 
				img.crossOrigin = "*"; 
				img.src = src; 
			}
			// 图片对象
			if(img instanceof Image === true) { 
				// 已经加载完成
				if(img.complete === true) resolve(this.scan(img)); 
				// 未加载完成等待
				else { 
					img.onload = () => resolve(this.scan(img)); 
					img.onerror = (err) => reject(err); 
				}
			}
		}); 
	}

	/*
	  @ 扫描识别线段 
	  @ 考虑到图片可能来自截图，所以添加两个参数：head & foot 表示图像的头与尾的占位
	*/
	scan(img, resolution = 4, head = 120, foot = 120) { 
	  head = head / resolution + 1 >> 0; foot = foot / resolution + 1 >> 0; 
	  // 颜色集
	  let colors = new Map(); 
	  let canvas = document.createElement("canvas"); 
	  let ctx = canvas.getContext("2d"); 
	  // 宽度是固定的750
	  let width = 750;
	  // img.with / width 的比率
	  let ratio = width / img.width; 
	  // 高度计算
	  let height = img.height * ratio; 

	  // 按分辨率压缩
	  width = width / resolution >> 0; 
	  height = height / resolution >> 0; 
	  canvas.width = width; 
	  canvas.height = height; 

	  ctx.drawImage(img, 0, 0, width, height); 

	  // imageData
	  let imageData = ctx.getImageData(0, 0, width, height); 
	  let data = imageData.data; 

	  // 起始索引
	  let startIndex = head * width * 4; 
	  // 终点索引
	  let endIndex = data.length - foot * width * 4; 

	  /*
	    @ 收集颜色
	    @ 扫描图像并收集图像的所有颜色
	    @ 由于底色被认定为是白色或透明，所以白色和透明不收集
	    @ 考虑到噪点对图像的影响，所以把接近白色的点也视作白色
	  */
	  // 线段颜色
	  let lineColor = [0, 0, 0, 0, 0]; 

	  // 端点颜色
	  let vertexColor = [0, 0, 0, 0, 0]; 

	  // 判断是否属于线段
	  let isBelongLine = (r, g, b, a) => {
	    return Math.abs(lineColor[0] - r) <= 10 && Math.abs(lineColor[1] - g) <= 10 && Math.abs(lineColor[2] - b) <= 10; 
	  }

	  // 判断是否属于端点
	  let isBelongVertex = (r, g, b, a) => {
	    return Math.abs(vertexColor[0] - r) <= 10 && Math.abs(vertexColor[1] - g) <= 10 && Math.abs(vertexColor[2] - b) <= 10;
	  }

	  // 判断是否属于底色
	  let isBelongBackground = (r, g, b, a) => {
	    return 255 - r <= 20 && 255 - g <= 20 && 255 - b <= 20 && 255 - a <= 20; 
	  }

	  // 扫描像素
	  for(let i = startIndex; i < endIndex; i += 4) { 
	    let r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]; 
	    // 过滤白色/透明/接近白色
	    if(a ===0 || isBelongBackground(r, g, b, a)) {
	      continue; 
	    }
	    let rgba = "rgba(" + r + "," + g + "," + b + "," + a + ")"; 
	    if(colors.has(rgba) === true) { 
	      let color = colors.get(rgba); 
	      color[4]++; 
	    }
	    else {
	      colors.set(rgba, [r, g, b, a, 1]); 
	    }
	  }

	  // 颜色最多的是线段的颜色
	  for(let color of colors.values()) { 
	    let countA = color[4], countB = lineColor[4]; 
	    if(countA > countB) lineColor = color; 
	  }

	  // 颜色第二多的是点的颜色
	  for(let color of colors.values()) {
	    let [r, g, b, a] = [color[0], color[1], color[2], color[3]]; 
	    if(isBelongLine(r, g, b, a)) {
	      continue; 
	    }
	    let countA = color[4], countB = vertexColor[4]; 
	    if(countA > countB) vertexColor = color; 
	  }

	  /*
	    @ 收集图像中的端点
	    @ 为了方便处理，把端点视作矩形（rect)
	  */
	  let vertexes = []; 
	  let collect = (index) => {
	    // 端点的边界 --- 用一个 rect 表示
	    let top = index / (width * 4) + 1 >> 0, right = (index % (width * 4)) / 4 >> 0, bottom = top, left = right; 
	    // RGBA
	    let r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3]; 
	    while(isBelongVertex(r, g, b, a)) { 
	      // 删除水平方向的点
	      let boundary = clearHorizontal(index); 
	      left = Math.min(left, boundary.left); 
	      right = Math.max(right, boundary.right); 
	      // 点往下移动
	      index += width * 4; 
	      r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3]; 
	      // bottom 像素加1
	      ++bottom; 
	    }
	    // 将点存入 vertexes
	    vertexes.push({top, right, bottom, left}); 
	  }

	  /*
	    @ 清空指定点左右同色的像素
	  */
	  let clearHorizontal = (index) => { 
	    // 左坐标
	    let leftIndex = index - 4; 
	    // 向左
	    while(isBelongVertex(data[leftIndex], data[leftIndex + 1], data[leftIndex + 2], data[leftIndex + 3])) {
	      // 把 a 设置为 0 表示清除
	      data[leftIndex + 3] = 0; 
	      // 向左移动
	      leftIndex -= 4; 
	    }
	    // 右坐标
	    let rightIndex = index; 
	    // 向右
	    while(isBelongVertex(data[rightIndex], data[rightIndex + 1], data[rightIndex + 2], data[rightIndex + 3])) {
	      // 把 a 设置为 0 表示清除
	      data[rightIndex + 3] = 0; 
	      // 向左移动
	      rightIndex -= 4; 
	    }

	    let left = (leftIndex % (width * 4)) / 4 >> 0, right = (rightIndex % (width * 4)) / 4 >> 0; 
	    return {left, right}; 
	  }

	  // 矩形相交
	  let isRectCross = (rectA, rectB) => { 
	    let {top: topA, right: rightA, bottom: bottomA, left: leftA} = rectA; 
	    let {top: topB, right: rightB, bottom: bottomB, left: leftB} = rectB; 
	    // 判断垂直方向是否具备相交条件
	    if(topA <= topB && bottomA >= topB || topB <= topA && bottomB >= topA) {
	      // 判断水平方向是否具备相交条件
	      if(leftA <= leftB && rightA >= leftB || leftB <= leftA && rightB >= leftA) {
	        return true; 
	      }
	    }
	    return false; 
	  }

	  // 合并矩形
	  let mergeRect = (rectA, rectB) => {
	    return {
	      top: Math.min(rectA.top, rectB.top), 
	      right: Math.max(rectA.right, rectB.right), 
	      bottom: Math.max(rectA.bottom, rectB.bottom), 
	      left: Math.min(rectA.left, rectB.left)
	    }
	  }

	  // 扫描图像
	  for(let i = startIndex; i < endIndex; i += 4) { 
	    let r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]; 
	    // 过滤白色/透明/接近白色
	    if(a === 0 || isBelongBackground(r, g, b, a)) {
	      continue; 
	    }
	    // 遇到端点
	    else if(isBelongVertex(r, g, b, a)) {
	      // 收集端点
	      collect(i); 
	    }
	  }

	  // 由于噪点的影响 vertexes 并不精准，需要进行一次归并
	  for(let i = 0; i < vertexes.length - 1; ++i) {
	    let rectA = vertexes[i]; 
	    // 跳过被删除的节点
	    if(!rectA) continue; 
	    for(let j = 0; j < vertexes.length; ++j) { 
	      let rectB = vertexes[j]; 
	      // 跳过被删除的节点
	      if(i === j || !rectB) continue; 
	      // 矩形相交
	      if(isRectCross(rectA, rectB) === true) { 
	        // 合并矩形
	        rectA = vertexes[i] = mergeRect(rectA, rectB); 
	        // 删除 rectB
	        delete vertexes[j]; 
	      }
	    } 
	  }

	  // 端点的中心坐标
	  let coords = []; 
	  // 端点的半径
	  let radius = 0;
	  // 过滤空洞
	  vertexes.forEach((rect) => { 
	    let w = rect.right - rect.left, h = rect.bottom - rect.top; 
	    // 半径取最大值
	    radius = Math.max(radius, w / 2, h / 2) >> 0; 
	    coords.push([rect.left + w / 2 >> 0, rect.top + h / 2 >> 0]); 
	  }); 

	  // 最终的线段
	  let lines = []; 

	  /*
	    @ 扫描两点之间是否存在线段
	    @ 思路：均分断点
	    @ AB间均分为 n 段，此时 A ---> B 之间均匀分布着 n - 1 个点
	    @ 校验这n个点是否属于线段
	  */

	  for(let i = 0, len = coords.length; i < len - 1; ++i) {
	    let aX = coords[i][0], aY = coords[i][1]; 
	    for(let j = i + 1; j < len; ++j) {
	      let bX = coords[j][0], bY = coords[j][1]; 
	      // AB 的距离
	      let distance = Math.sqrt(Math.pow(aX - bX, 2) + Math.pow(aY - bY, 2)); 
	      // AB 均分为 n 个子线段，每个子线段的长度不得大于端点的直径，避免漏扫描
	      let n = distance / (2 * radius) >> 0;
	      // 子线段的步长（分X与Y）
	      let stepX = (bX - aX) / n, stepY = (bY - aY) / n; 
	      while(--n > 0) {
	        let index = (aX + stepX * n >> 0) * 4+ (aY + stepY * n >> 0) * width * 4; 
	        let [r, g, b, a] = [data[index], data[index + 1], data[index + 2], data[index + 3]]; 
	        // 断点没有落在线段上
	        if(!isBelongLine(r, g, b, a)) break; 
	      }

	      // 被检验的点都在线段上，表示 AB 成线
	      if(0 === n) {
	        // 还原尺寸
	        lines.push(
	            {
	              x1: coords[i][0] * resolution, 
	              y1: coords[i][1] * resolution, 
	              x2: coords[j][0] * resolution, 
	              y2: coords[j][1] * resolution
	            }
	        ); 
	      } 
	    }
	  }

	  // 删除对象
	  canvas = colors = imageData = data = null; 
	  // return {vertexColor, lineColor, lines}; 
	  // 端点颜色
	  let baseVertexColor = vertexColor[0] * Math.pow(256, 2) + vertexColor[1] * Math.pow(256, 1) + vertexColor[2]; 
	  // 线段颜色
	  let baseLineColor = lineColor[0] * Math.pow(256, 2) + lineColor[1] * Math.pow(256, 1) + lineColor[2]; 
	  // 手绘线的颜色取端点的半色值
	  let strokeColor = vertexColor[0] * Math.pow(256, 2) / 2 + vertexColor[1] * Math.pow(256, 1) / 2 + vertexColor[2] / 2; 

	  return { 
			lineColor: baseLineColor, 
			vertexColor: baseVertexColor, 
			strokeColor: strokeColor, 
			activeVertexColor: baseVertexColor, 
			lines: lines
		}
	}
}


