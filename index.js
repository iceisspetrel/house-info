const cheerio = require('cheerio');
const request = require('request');
const fs = require('fs');
const path = require('path');

let total = 0;

/**根据分页码，获取楼盘信息， 主要提取楼盘名字以及楼盘明细的地址 */
function getAllItems (page) {
    const base_url = 'https://www.cdfangxie.com/Infor/type/typeid/36.html?&p=' + page;
    return new Promise((resolve, reject) => {
        const items = [];
        request(base_url, (error, resp, body) => {
            if(!error && resp.statusCode === 200) {
                const $ = cheerio.load(body);
                const lis = $('.ul_list li');

                total = $('.pages2').text().split('/')[1].split(' ')[0] - 0;

                lis.map((i, d) => {
                  if(!$(d).hasClass('line')) {
                    const a = $('a', $(d))[0];
                    const span = $('span', $(d))[1];
                    items.push({
                        name : a.attribs.title,
                        href : a.attribs.href,
                        date : span.children[0].data
                    });
                  }
                });
            }
            resolve(items);
        });
    });
}

function getHouseDetail (name, url, date) {
  return new Promise((resolve, reject) => {
    request(url, (error, resp, body) => {
      if(!error && resp.statusCode === 200) {
        const $ = cheerio.load(body);
        const a = $('.MsoNormal a')[0];  
        resolve({
          name,
          date,
          href : a.attribs.href
        });
      }
    });
  });
}


/**
 * 下载房源文件
 * @param {*} option 
 */
function download (option = {}, index, total) {
  return new Promise((resolve, reject) => {
    const {name, href, date} = option;
    const names = name.split('|');

    let dir = path.join(__dirname, '房源资料');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    const now = new Date();
    dir = path.join(dir, now.getFullYear() + '-' + date);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    dir = path.join(dir, names[0]);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }

    const reg = /([^.]+)$/;
    const fileType = href.match(reg)[1];

    const filename = names[0] + '-' + names[1] + '.' + fileType;

    const seq = index > 9 ? index : '0' + index;

    console.log('任务' + seq + ' === 开始下载第 ' + index + '/' + total + ' 个文件：' + filename);
    request(href).pipe(
      fs.createWriteStream(path.join(dir, filename))
    ).on('close', () => {
      console.log('任务' + seq + ' === 下载完成');
      resolve();
    });
  });
}

// 获取所有楼盘信息
async function getAllHouseInfo (pagers = 1) {
  let result = [];

  const pages = [];
  for(let x=1; x<=pagers; x++){
    pages.push(x);
  }

  let len = pages.length;
  for(let i=0; i<len; i++){
    const res = await getAllItems(pages[i]);
    result = [...result, ...res];
  }

  let infos = [];
  for (let m=0; m<result.length; m++) {
    const info = await getHouseDetail(result[m].name, 'https://www.cdfangxie.com' + result[m].href, result[m].date);
    infos = [...infos, {...info}];
  }
  
  for(i=0; i<infos.length; i++){
    await download(infos[i], i+1, infos.length);
  }
  console.log('===================' + infos.length + '个文件已全部下载完成=================================');
  console.log('===================文件存放地址：' + path.join(__dirname, '房源资料') + '==================================');
}

getAllHouseInfo(3);