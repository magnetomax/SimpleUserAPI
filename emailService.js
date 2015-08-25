var config = require('./config');
var sendgridobj = require("sendgrid")(config.sendgridUser,config.sendgridApi);

var emailService = function(){
 this.sendgrid = sendgridobj;	
 this.emailObj = new this.sendgrid.Email();
 this.emailObj.setFrom('noreply@tiffincounter.com');
 this.emailObj.setSubject('The is a subject');
 this.emailObj.fromname = 'The TiffinCounter Team';
};

emailService.prototype.getEmailObj = function(){
	return this.emailObj;
}

emailService.prototype.setSubject = function(subject){
	if(subject){
		this.emailObj.setSubject(subject);
	}
}

emailService.prototype.setHtml = function(html){
	if(html){
		this.emailObj.setHtml(html);
	}
};

emailService.prototype.setText = function(text){
	if(text){
		this.emailObj.setText(text);
	}
};

emailService.prototype.setSender = function(email){
	if(email){
		this.emailObj.addTo(email);
	}
};

emailService.prototype.attachFile = function(path){
	if(path){
		this.emailObj.addFile({
	  		'path': path
		});
	}
};

emailService.prototype.sendEmail = function(callback){
	var self = this;

	try {
	    self.sendgrid.send(self.emailObj, function(err, json) {
	        if (err) callback(err);
	        callback(null,json);
	    });
	} catch(e) {
	    callback(e);
	}
};



module.exports = new emailService();
