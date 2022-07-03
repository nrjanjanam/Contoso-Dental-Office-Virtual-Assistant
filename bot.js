// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const { stringify } = require('json5');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration);
       
        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);

        // create a IntentRecognizer connector
        this.IntentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            try{
                const qnaResult = await this.QnAMaker.getAnswers(context);
                const luisResult = await this.IntentRecognizer.executeLuisQuery(context);
                const topIntent = luisResult.luisResult.prediction.topIntent;

                let message;

                if(luisResult.intents[topIntent].score >= 0.65){
                    console.log(`Top Intent : ${topIntent}`);
                    if(topIntent === 'GetAvailability'){
                        message = await this.DentistScheduler.getAvailability(this.IntentRecognizer.getTimeEntity(luisResult));
                    }
                    else if(topIntent === 'ScheduleAppointment'){
                        message = await this.DentistScheduler.scheduleAppointment(this.IntentRecognizer.getTimeEntity(luisResult));
                    }
                    else{
                        message = 'Kindly rephrase your question, I am unable to help you out.';
                    }
                }
                else if(qnaResult[0] != undefined){
                    message = qnaResult[0].answer;
                } else {
                    message = 'Kindly rephrase your question, I am unable to help you out.';
                }    
             
            await context.sendActivity(MessageFactory.text(message, message));
        }catch(e){
            console.log("Error Occured:", e);
        }
        await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Welcome to Contoso Dental Clinic. I am Alicia at your service. You can use my help to solve any FAQs or book an appointment.';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });
    }
}

module.exports.DentaBot = DentaBot;
