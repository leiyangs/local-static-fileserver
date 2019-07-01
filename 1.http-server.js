// http-server  npm 模块
let http = require('http');
let url = require('url');
let path = require('path');
let fs = require('fs').promises;
let {
  createReadStream,
  readFileSync
} = require('fs');
let mime = require('mime');
let crypto = require('crypto'); // node中的md5模块
let ejs = require('ejs');
let template = readFileSync(path.resolve(__dirname, 'template.ejs'), 'utf8');   // 提前获取模板中的内容
let chalk = require('chalk');

module.exports = class MyServer {
  // 类中用到的属性都要挂到当前的实例上，为了保证一致性
  constructor(config) {
    this.template = template;
    this.config = config;
  }
  async handleRequest(req, res) { // request监听函数
    let {
      pathname
    } = url.parse(req.url);
    pathname = decodeURIComponent(pathname);   // 中文命名的文件夹会自动编码，这里需要解码  encodeURIComponent(编码)
    let absPath = path.join(this.config.cwd, pathname);

    if (req.headers.origin) { // 如果有跨域
      // 允许跨域头
      // res.setHeader('Access-Control-Allow-Origin', "*");
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin); // req.headers.origin只有跨域时候才会有这个参数
      // 设置支持的请求
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
      // 允许哪些头访问我
      res.setHeader('Access-Control-Allow-Headers', 'name');
      // 一分钟内不再发options请求 单位是秒
      res.setHeader('Access-Control-Max-Age', 60);
      // 后端设置cookie(跨域不支持cookie传递)
      res.setHeader('Set-Cookie', 'zh=aaa');
      // console.log(req.headers.cookie)
      // 允许前端携带凭证(解决跨域不支持cookie的问题)
      res.setHeader('Access-Control-Allow-Creadentials', ture);
      // 非简单请求(put,delete或者ajax设置setRequestHeader('name','yang'))，会先发options请求
      if (req.method === 'options') {
        res.end()
      }
    }

    // 先在静态文件之前处理动态的接口
    if (pathname === '/user' && req.method === 'GET') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        name: 'yang'
      }));
      return
    }
    if (pathname === '/user' && req.method === 'DELETE') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        name: 'yang'
      }));
      return
    }

    // 处理静态文件
    try {
      let stat = await fs.stat(absPath);
      if (stat.isDirectory()) {
        absPath = path.join(absPath, 'index.html');
        try {
          await fs.access(absPath);
        } catch (e) {
          // 如果没有index.html则回到上级(取父级目录的内容)
          let dirPtah = path.dirname(absPath);   // 获取当前文件的父目录
          let dirs = await fs.readdir(dirPtah);   // 读取当前目录下的内容
          let currentPath = pathname.endsWith('/') ? pathname : pathname + '/';
          let template = ejs.render(this.template, { currentPath, arr: dirs });  //ejs
          res.setHeader('Content-Type', 'text/html;charset=utf-8;')
          res.end(template);
          return
        }
      }
      this.sendFile(absPath, req, res, stat);
    } catch (error) {
      // console.log(error,'error')
      this.sendError(error, req, res);
    }
  }
  async sendFile(path, req, res, stat) { // 返回文件
    let cache = await this.cache(path, req, res, stat);
    if (cache) {
      res.statusCode = 304;
      res.end();
      return
    }
    res.statusCode = 200;
    // 压缩
    res.setHeader('Content-Type', mime.getType(path) + ';charset=utf-8');
    let gzip = this.gzip(path, req, res, stat);
    if (gzip) {
      createReadStream(path).pipe(gzip).pipe(res);
      return
    }
    createReadStream(path).pipe(res);
  }
  gzip(path, req, res, stat) {
    let encoding = req.headers['accept-encoding'] // 获取浏览器支持的压缩格式
    if (!encoding) return false;
    if (encoding.match(/\bgzip\b/)) {
      res.setHeader('Content-Encoding', 'gzip');
      return require('zlib').createGzip();
    } else if (encoding.match(/\deflate\b/)) {
      res.setHeader('Content-Encoding', 'deflate');
      return require('zlib').createDeflate();
    } else {
      return false;
    }
  }
  async cache(path, req, res, stat) {
    res.setHeader('Expires', new Date(Date.now() + 6 * 1000).toGMTString()); // 兼容老版本浏览器 当前时间+2秒过期

    let lastModified = stat.ctime.toGMTString();
    res.setHeader('last-Modified', lastModified);
    let ifMOdifidSince = req.headers['if-modified-since'];
    if (lastModified !== ifMOdifidSince) {
      return false
    }

    let buffer = await fs.readFile(path);
    let md5 = crypto.createHash('md5').update(buffer).digest('base64');
    res.setHeader('Etag', md5); // 把文件md5加密设置为唯一的指纹
    let ifNoneMatch = req.headers['if-none-match'];
    if (md5 !== ifNoneMatch) {
      return false
    }
  }
  sendError(error, req, res) { // 返回错误
    res.statusCode = 404;
    res.end('Not Found');
  }
  start() {
    let server = http.createServer(this.handleRequest.bind(this)); // 把this指向MyServer
    server.listen(this.config.port,() => {
      console.log(
        `${chalk.yellow(`Starting up http-server, serving ./`)}
Available on:
  http://127.0.0.1:${chalk.green(this.config.port)}
Hit CTRL-C to stop the server`
      )
    });
  }
}
