// server/core/code-transformer.js
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

class CodeTransformer {
  static asyncMethods = [
    'User.getData', 'User.saveData', 'User.deleteData', 'User.increment',
    'User.getAllData', 'User.clearAll',
    'BotData.getData', 'BotData.saveData', 'BotData.deleteData',
    'wait', 'delay', 'sleep', 'waitForAnswer', 'ask',
    'runPython', 'executePython'
  ];

  static botMethods = [
    'sendMessage', 'sendPhoto', 'sendDocument', 'sendVideo', 'sendAudio',
    'sendVoice', 'sendLocation', 'sendContact', 'sendSticker', 'sendVenue',
    'sendPoll', 'sendDice', 'sendChatAction', 'sendMediaGroup', 'sendInvoice',
    'forwardMessage', 'copyMessage', 'editMessageText', 'editMessageCaption',
    'editMessageMedia', 'editMessageReplyMarkup', 'deleteMessage', 
    'deleteMessages', 'getChat', 'getChatAdministrators', 'getChatMemberCount',
    'getChatMember', 'banChatMember', 'unbanChatMember', 'restrictChatMember',
    'promoteChatMember', 'setChatPermissions', 'exportChatInviteLink',
    'createChatInviteLink', 'editChatInviteLink', 'revokeChatInviteLink',
    'setChatPhoto', 'deleteChatPhoto', 'setChatTitle', 'setChatDescription',
    'pinChatMessage', 'unpinChatMessage', 'unpinAllChatMessages', 'leaveChat',
    'getFile', 'getMe', 'getUserProfilePhotos', 'answerCallbackQuery',
    'answerInlineQuery', 'setMyCommands', 'getMyCommands', 'deleteMyCommands'
  ];

  static transform(code) {
    try {
      return this.advancedASTTransform(code);
    } catch (error) {
      console.log('⚠️ AST transform failed, using simple method:', error.message);
      return this.simpleTransform(code);
    }
  }

  static simpleTransform(code) {
    let transformed = code;
    
    // Transform User and BotData methods
    this.asyncMethods.forEach(method => {
      const regex = new RegExp(`(\\b${method}\\s*\\()`, 'g');
      transformed = transformed.replace(regex, `await $1`);
    });
    
    // Transform bot methods (both bot.method and Bot.method)
    this.botMethods.forEach(method => {
      const patterns = [
        new RegExp(`(\\bbot\\.${method}\\s*\\()`, 'g'),
        new RegExp(`(\\bBot\\.${method}\\s*\\()`, 'g'),
        new RegExp(`(\\bapi\\.${method}\\s*\\()`, 'g'),
        new RegExp(`(\\bApi\\.${method}\\s*\\()`, 'g'),
        new RegExp(`(\\bAPI\\.${method}\\s*\\()`, 'g')
      ];
      
      patterns.forEach(pattern => {
        transformed = transformed.replace(pattern, `await $1`);
      });
    });
    
    return transformed;
  }

  static advancedASTTransform(code) {
    const ast = parser.parse(code, {
      sourceType: 'script',
      plugins: [],
      allowAwaitOutsideFunction: true
    });

    traverse(ast, {
      CallExpression(path) {
        const { node } = path;
        
        // Skip if already awaited
        if (t.isAwaitExpression(path.parent)) {
          return;
        }

        let shouldAddAwait = false;
        let methodName = '';

        // Case 1: Member expressions like User.getData(), bot.sendMessage()
        if (t.isMemberExpression(node.callee)) {
          const objectName = node.callee.object.name;
          const propertyName = node.callee.property.name;
          
          methodName = `${objectName}.${propertyName}`;
          
          // Check User/BotData methods
          if (CodeTransformer.asyncMethods.includes(methodName)) {
            shouldAddAwait = true;
          }
          
          // Check bot methods with different object names
          if (['bot', 'Bot', 'api', 'Api', 'API'].includes(objectName) && 
              CodeTransformer.botMethods.includes(propertyName)) {
            shouldAddAwait = true;
          }
        }
        
        // Case 2: Direct function calls like wait(), runPython()
        else if (t.isIdentifier(node.callee)) {
          methodName = node.callee.name;
          if (CodeTransformer.asyncMethods.includes(methodName)) {
            shouldAddAwait = true;
          }
        }

        // Add await if needed
        if (shouldAddAwait) {
          console.log(`🔧 Auto-await added for: ${methodName}`);
          path.replaceWith(t.awaitExpression(node));
        }
      }
    });

    const result = generate(ast, { 
      concise: true,
      retainLines: true 
    }).code;

    return result;
  }

  static testTransformation(code) {
    console.log('🧪 Testing transformation...');
    console.log('📝 Original:', code);
    const transformed = this.transform(code);
    console.log('✨ Transformed:', transformed);
    return transformed;
  }
}

// Test cases
if (require.main === module) {
  const testCode = `
const name = User.getData('user_name');
bot.sendMessage('Hello ' + name);
Bot.saveData('last_used', new Date());
wait(1000);
runPython('2+2');
  `;
  
  CodeTransformer.testTransformation(testCode);
}

module.exports = CodeTransformer;