module.exports = {
    python_calc_bot: {
        name: "Python Calculator (bot style)",
        patterns: "/calc,calculate,math",
        code: `// Python calculator using bot style
const result = await bot.runPython(\`
num1 = 10
num2 = 5
result = num1 + num2
print(f"Calculation: {num1} + {num2} = {result}")
\`);

bot.sendMessage(\`🐍 Python Result:\\n\\n\${result}\`);`
    },

    python_calc_api: {
        name: "Python Calculator (Api style)",
        patterns: "/calc2,calculate2", 
        code: `// Python calculator using Api style
const result = await Api.runPython(\`
num1 = 15
num2 = 3
result = num1 * num2
print(f"Calculation: {num1} × {num2} = {result}")
\`);

Api.sendMessage(\`🐍 Python Result:\\n\\n\${result}\`);`
    }
};