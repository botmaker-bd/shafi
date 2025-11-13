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
    },

    python_web_bot: {
        name: "Python Web Scraping (bot style)",
        patterns: "/scrape,web,data",
        code: `// Python web scraping using bot style
const result = await bot.runPython(\`
import requests
from bs4 import BeautifulSoup

# Example web scraping
response = requests.get('https://httpbin.org/json')
data = response.json()
result = f"Fetched data: {data['slideshow']['title']}"
\`);

bot.sendMessage(\`🌐 Web Data:\\n\\n\${result}\`);`
    },

    python_ai_api: {
        name: "Python AI (Api style)",
        patterns: "/ai,pythonai",
        code: `// Python AI using Api style
const result = await Api.runPython(\`
import numpy as np
import pandas as pd

# Simple ML example
data = {'x': [1, 2, 3, 4, 5], 'y': [2, 4, 6, 8, 10]}
df = pd.DataFrame(data)
slope = np.polyfit(df['x'], df['y'], 1)[0]
result = f"Linear regression slope: {slope:.2f}"
\`);

Api.sendMessage(\`🤖 AI Result:\\n\\n\${result}\`);`
    }
};