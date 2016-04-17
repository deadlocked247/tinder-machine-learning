"use strict";
const request = require('request');
const brain = require('brain');
var query = require('cli-interact').getYesNo;
var util = require('util');
var Jimp = require("jimp");
var http = require('http');
var fs = require('fs');

var deleteFolderRecursive = function(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

/*
https://www.facebook.com/dialog/oauth?client_id=464891386855067&redirect_uri=https://www.facebook.com/connect/login_success.html&scope=basic_info,email,public_profile,user_about_me,user_activities,user_birthday,user_education_history,user_friends,user_interests,user_likes,user_location,user_photos,user_relationship_details&response_type=token
*/
const tinder_fb_url = ""; // VISIT THAT LINK ABOVE AND PASTE HERE

function tinderAuth() {
    var id = tinder_fb_url.match(/#access_token=(.+)&/)[1];
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.gotinder.com/auth',
            method: 'POST',
            json: true,
            body: { "facebook_token": id },
            headers: {
                'Content-Type': 'application/json',
                'User-agent': 'Tinder/4.6.1 (iPhone; iOS 9.1; Scale/2.00)'
            }
        }, (error, response, body) => {
    	    if(error) {
                reject();
    	    } else {
    	        resolve(body);
    	    }
    	});
    });
}

function getRecs(token) {
    return new Promise((resolve, reject) => {
        request({
            url: 'https://api.gotinder.com/user/recs',
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-agent': 'Tinder/4.6.1 (iPhone; iOS 9.1; Scale/2.00)',
                'X-Auth-Token': token
            }
    	}, (error, response, body) => {
    	    if(error) {
    	        reject();
    	    } else {
                resolve(body);
    	    }
        });
    })
}

function loopRecs(recs) {
    var first = false;
    var promises = [];
    for (let x in recs) {
        promises.push(new Promise((resolve, reject) => {
            let id = recs[x]._id;
            Jimp.read(recs[x].photos[0].processedFiles[3].url, ((err, picture) => {
                if (err) reject(err);
                var arr = [];
                for (var x = 0; x < picture.bitmap.width; x++) {
                    for (var y = 0; y < picture.bitmap.height; y++) {
                        arr.push(picture.getPixelColor(x, y));
                        /*
                        var obj = Jimp.intToRGBA(picture.getPixelColor(x, y));
                        arr.push({
                            r: obj.r/256,
                            g: obj.g/256,
                            b: obj.b/256,
                            a: obj.a/256
                        }); */
                    }
                }
                picture.write("./pictures/" + id + ".png", () => {
                    resolve(arr);
                });
            }));
        }))
    }

    Promise.all(promises)
    .then(function (payload) {
        for (var x in recs) {
            if (first) {
                var ml = net.run(payload[x]);
                console.log("\nSWIPE RIGHT PROBABILITY: " + ml.swipe);
            }
            console.log("NAME: " + recs[x].name);
            console.log(recs[x].teaser.type + ": " + recs[x].teaser.string);
            console.log("BIO: " + recs[x].bio);
            console.log("MILES AWAY: " + recs[x].distance_mi);
            console.log("CONNECTIONS: " + recs[x].connection_count);
            console.log("COMMON FRIENDS: " + recs[x].common_friend_count);
            console.log("COMMON LIKES: " + recs[x].common_like_count);
            console.log("PICTURE PATH: " + "./pictures/" + recs[x]._id + ".png")
            var answer = query('Swipe?');
            console.log('You swiped:', answer);
            console.log(payload[x][0]);
            net.train([{input: payload[x], output: { swipe: answer ? 1 : 0 }}]);
            first = true;
        }
        deleteFolderRecursive("./pictures");
    })
    .catch(function (payload) {
        console.log(payload);
    });
}

var net = new brain.NeuralNetwork();

if (!fs.existsSync("./pictures")){
    fs.mkdirSync("./pictures");
}

tinderAuth()
.then((payload) => {
    return getRecs(payload.token);
})
.then((payload) => {
    loopRecs(JSON.parse(payload).results);
})
