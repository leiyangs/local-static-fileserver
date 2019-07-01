#! /usr/bin/env node
// 指定在什么环境执行

// 引入server类，并启动一个服务   npm link 到全局，然后在任何目录启动服务，都是以当前目录为根目录(cwd获取当前的工作目录)
let config = {
  cwd: process.cwd(),   // 返回 Node.js 进程的当前工作目录。
  port: 3000
}
// 解析用户命令行传入的参数，来替换默认参数
// commander yargs
let yargs = require('yargs');
let opt = yargs.option('port', {
  alias: 'P',
  default: 3000
}).argv
Object.assign(config, opt);

let MyServer = require('../1.http-server');
let server = new MyServer(config);
server.start();