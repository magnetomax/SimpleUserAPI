
var config = require('./config');
var express = require('express');
var app = express();
var db = require('orchestrate')(config.orcestrateApiKey,config.orchestrateLocation);
var bodyParser = require('body-parser');
var async = require('async');
var crypto = require('crypto');
var morgan = require('morgan');
var jwt = require('jsonwebtoken');
var emailService = require('./emailService.js');
var uuid = require('node-uuid');
var port = process.env.PORT || 8090;        // set our port
var sha256;
// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router
// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// more routes for our API will happen here
app.set('superSecret', config.secret);
app.use(morgan('dev'));
// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);
//convert to SHA
function shaConversion(passString){ console.log('PASSWORD : ',passString);
	return crypto.createHash('sha256').update(passString).digest('base64');
}

	// route to authenticate a user (POST http://localhost:8080/api/authenticate)
	router.post('/authenticate', function(req, res) {

		var user,password = shaConversion(req.body.password);
	    // find the user
	  	//db.search('users', '@value.emailId:'+req.body.emailId)
		req.body.emailId?db.newSearchBuilder()
		.collection('users')
		.query(req.body.emailId)
		.then(function (resp) {
			if(!resp.body.results[0].value.userRegistered){
				res.status(400).json({ message: 'Authentication failed. User not active.' });
			}
			else if(resp.body.count && password === resp.body.results[0].value.password){
				user = resp.body.results[0].value;
		        // create a token
		        var token = jwt.sign(user, app.get('superSecret'), {
		          expiresInMinutes: 1440 // expires in 24 hours
		        });
		        // return the information including token as JSON
		        res.json({message: 'Enjoy your token!',
		        	token: token,
		        	name:user.username,
		        	email:user.emailId,
		        	id:resp.body.results[0].path.key});
			}
			else{
				res.status(400).json({ message: 'Authentication failed. Invalid Credentials.' });
			}
		})
		.fail(function (err) {
				res.status(500).json({ message: 'Database Error',actualError:err });
		}):res.status(400).json({ message: 'Authentication failed. No emailId.' });

	  });

	router.route('/userConfirmation/:activationKey').get(function(req,res){
		if(req.params.activationKey){
			db.search('users',req.params.activationKey)
			.then(function(resp){
				var path = resp.body.results[0].path;
				var user = resp.body.results[0].value;
				user.userStatus = 'active';
				user.userRegistered = true;
				user.userActivationKey = '';
				user.userKey = path.key;
				user.userRef = path.ref;
				//Database Update
				db.put('users', path.key, user, path.ref)
				.then(function(resp){
					res.json({message:'User Confirmed.'});
				})
				.fail(function(err){
					res.status(500).json({message:'User Database Update Failed.',actualError:err});
				});
			})
			.fail(function(err){
				res.status(500).json({message:'Database error.',actualError:err});
			});
		}
		else{
			res.status(400).json({message:'No activation key provided.'});
		}
	});

	router.route('/registerUser')
    // create a bear (accessed at POST http://localhost:8080/api/bears)
    .post(function(req, res) {
    	var data = {
			'username': req.body.name,
			'emailId': req.body.email,
			'password': shaConversion(req.body.password),
			'mobileNumber':req.body.mobileNumber,
			'role':'regUser',
			'userStatus':'inactive',
			'userRegistered':false,
			'userActivationKey':'',
			'userPasswordRecoveyToken':'',
			'userKey':'',
			'userRef':'',
			'imgUrl':''
	  	};

    	async.waterfall([
    		function(done){
    			if(!req.body.email||!req.body.name||!req.body.password)done({message:'Field Blank'});
    			db.search('users', req.body.email)
				.then(function (res) {
					if(res.body.count){
					    done({ message: 'User Already Registered.' });
					}
					else{
						done(null);
					}
				})
				.fail(function (err) {
						done({ message: 'Error',actualError:err });
				});
    		},
		  function(done){
		  	crypto.randomBytes(20, function(err, buf) {
		        data.userActivationKey = buf.toString('hex');
		        done(err?{message:'generator error',actualError:err}:null,data);
		    });
		  },
		  function(data,done){
		    db.post('users',data )
			.then(function (result) {
				done(null, data);
			})
			.fail(function (err) {
				done({message:'Database Error',actualError:err}, 'error');
			});
		  },
		  function(data,done){
		  	emailService.setSubject('User Confirmation');
			emailService.setHtml('<h2>Hello '+data.username+',</h2><p>Please click on the link below to confirm the user</p><a href='+req.protocol+'://'+req.get('host')+'/api/userConfirmation/'+data.userActivationKey+'>ClickHere</a>');
			emailService.setSender(data.emailId)
			emailService.sendEmail(function(err,data){
				done(null,'done');
			});
		  }
		], function (err, result) {
			console.log('final result : ');
		 	if(result != 'done'){
		 		res.status(500).json(err);
		 	}
		 	else{
		 		res.json({ message: 'User Registered','result':result });
		 	}
		});
    });

router.post('/recoverPassword',function(req,res){
	var user,path;
	async.waterfall([
    		function(done){
    			if(!req.body.email)done({message:'Field Blank'});
    			db.search('users', req.body.email)
				.then(function (res) {
					if(res.body.count){
						user = res.body.results[0].value;
						path = res.body.results[0].path;
						if(user.userRegistered){
							done(null);
						}
						else{
							done({ message:'User Not Activated.'})
						}
					}
					else{
						done({ message: 'User Does Not Exist.' });
					}
				})
				.fail(function (err) {
					done({ message: 'Database Error',actualError:err });
				});
    		},
		  function(done){
		  	crypto.randomBytes(20, function(err, buf) {
		        user.userPasswordRecoveyToken = buf.toString('hex');
		        done(err?{message:'Key Generator Error',actualError:err}:null);
		    });
		  },function(done){
		  	db.put('users', path.key, user, path.ref)
			.then(function(resp){
				done(null);
				//res.json({message:'User Confirmed.'});
			})
			.fail(function(err){
				done({message:'Database Update Error.',actualError:err});
			});
		},
		function(done){
		  	emailService.setSubject('Password Reset');
			emailService.setHtml('<h2>Hello '+user.username+',</h2><p>Please click on the link below to reset password.</p><a href='+req.protocol+'://'+req.get('host')+'/api/passwordReset/'+user.userPasswordRecoveyToken+'>ClickHere</a>');
			emailService.setSender(user.emailId)
			emailService.sendEmail(function(err,data){
				if(!err){
					done(null,'done');
				}
				else{
					done({message:'Email Sending Failed.',actualError:err})
				}
			});
		  }],function (err, result) {
			console.log('final result : ');
		 	if(result != 'done'){
		 		res.status(500).json(err);
		 	}
		 	else{
		 		res.json({ message: 'Recovery Email Sent.' });
			}
	});
});

router.post('/passwordReset',function(req,res){
	if(req.body.recoveryToken){
		db.search('users',req.body.recoveryToken)
		.then(function(resp){
			var path = resp.body.results[0].path;
			var user = resp.body.results[0].value;
			if(user.emailId===req.body.emailId){
				user.password=req.body.password;
				user.userPasswordRecoveyToken= '';
				//Database Update
				db.put('users', path.key, user, path.ref)
				.then(function(resp){
					emailService.setSubject('Password Changed');
					emailService.setHtml('<h2>Hello '+data.username+',</h2><p>Your password has been reset.</p>');
					emailService.setSender(data.emailId)
					emailService.sendEmail(function(err,data){
						res.json({message:'Password Changed.'});
					});
				})
				.fail(function(err){
					res.status(500).json({message:'User Database Update Failed.',actualError:err});
				});
			}
			else{
				res.status(500).json({message:'Email do not match.'});
			}
		})
		.fail(function(err){
			res.status(500).json({message:'Database Error.',actualError:err});
		});
	}
	else{
		res.status(400).json({message:'No Recovery Key Provided.'});
	}
});

// route middleware to verify a token
router.use(function(req, res, next) {

  // check header or url parameters or post parameters for token
  var token = req.headers['x-access-token'];
 if (token) {

    // verifies secret and checks exp
    jwt.verify(token, app.get('superSecret'), function(err, decoded) {
      if (err) {
        return res.status(401).json({ message: 'Failed to authenticate token.' });
      } else {
        // if everything is good, save to request for use in other routes
        req.decoded = decoded;
        next();
      }
    });

  } else {

    // if there is no token
    // return an error
    return res.status(403).send({message: 'No token provided.'});

  }
});

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

    router.get('/users', function(req, res) {
	  	db.list('users')
		.then(function (result) {
		  	var items = result.body.results;
		  	res.json(items);
		})
		.fail(function (err) {
			res.status(500).json(err)
		})
	});

	router.put('/updateProfile',function(req,res){
		var user = req.decoded;
		if(req.body.emailId){
			user.mobileNumber = req.body.mobileNumber;
			user.imageUrl = req.body.imageUrl;
			db.put('users', user.userKey, user, user.userRef)
			.then(function(resp){
				res.json({message:'User Profile Changed.'});
			})
			.fail(function(err){
				res.status(500).json({message:'User Database Update Failed.',actualError:err});
			});
		}
		else{
			res.status(400).json({'message':'Bad Request.'});
		}
	});

	router.route('/userPosts').post(function(req,res){
		if (req.body.postTitle && req.body.postContent) {
			var postId = uuid.v1();
			var post = {
				'postTitle':req.body.postTitle,
				'postContent':req.body.postContent
			};
			db.put('posts',postId,post,false).then(function(resp){
				db.newGraphBuilder()
				.create()
				.from('users', req.decoded.userKey)
				.related('creates')
				.to('posts', postId)
				.then(function (resp) {
				  res.json({message:'Post Created.'});
				})
				.fail(function(err) {
					res.status(500).json({message:'334Database Error.',actualError:err});
				});
			})
			.fail(function(err) {
				res.status(500).json({message:'348Database Error.',actualError:err});
			});
		}
		else {
			res.status(400).json({message:'Bad Request.'});
		}
	})

	.get(function(req,res) {
		db.newGraphReader()
		.get()
		.from('users', req.decoded.userKey)
		.related('creates')
		.then(function (resp) {
		  res.json(resp.body.results);
		})
		.fail(function(err) {
			res.status(500).json({message:'Database Error.',actualError:err});
		});
	});


	// .put(function(req,res) {
	//
	// });
// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);
