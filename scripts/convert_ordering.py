#!/usr/bin/env python3
import re
import json

def convert_ordering_questions():
    with open('client/src/data/questions.ts', 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match ordering questions
    pattern = r'({\s*id:\s*"ordering-\d+",\s*points:\s*\d+,\s*q:\s*"[^"]*",\s*a:\s*)"([^"]+)"'
    
    def replacer(match):
        prefix = match.group(1)
        answer_str = match.group(2)
        
        # Split by ➔ to get individual items
        items = [item.strip() for item in answer_str.split('➔')]
        
        # Create JSON arrays
        items_json = json.dumps(items, ensure_ascii=False)
        correct_order_json = json.dumps(items, ensure_ascii=False)
        
        # Return with added orderItems and correctOrder
        return f'{prefix}"{answer_str}", orderItems: {items_json}, correctOrder: {correct_order_json}'
    
    # Replace all ordering questions
    converted = re.sub(pattern, replacer, content)
    
    # Count replacements
    count = len(re.findall(pattern, content))
    
    with open('client/src/data/questions.ts', 'w', encoding='utf-8') as f:
        f.write(converted)
    
    print(f'Converted {count} ordering questions')

if __name__ == '__main__':
    convert_ordering_questions()
