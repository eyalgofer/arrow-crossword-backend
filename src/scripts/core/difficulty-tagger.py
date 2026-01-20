import pandas as pd
from wordfreq import word_frequency

# 1. Load your CSV
# Assuming columns: 'Answer', 'Clue'
df = pd.read_csv('train.csv')

def calculate_difficulty(row):
    answer = str(row['answer']).lower()
    clue = str(row['clue']).lower()
    
    # Base Score starts at 3 (Medium)
    score = 3
    
    # --- Factor A: Word Frequency (using Swedish 'sv' or English 'en') ---
    # Frequency is usually a tiny float (e.g., 0.0001)
    freq = word_frequency(answer, 'en') 
    
    if freq > 0.0001: # Very common word
        score -= 1
    if freq < 0.000001: # Very obscure word
        score += 1
        
    # --- Factor B: Clue Indicators ---
    # Question marks usually mean misdirection (Harder)
    if '?' in clue:
        score += 1
    # Fill in the blanks are usually easy
    if '___' in clue or '...' in clue:
        score -= 1
        
    # --- Factor C: Length ---
    if len(answer) <= 3:
        score -= 1
    elif len(answer) > 10:
        score += 1

    # Constrain score between 1 and 5
    return max(1, min(5, score))

# Apply the function
df['difficulty'] = df.apply(calculate_difficulty, axis=1)

# 2. Save the tagged file
df.to_csv('train_difficulty.csv', index=False)
print("Finished tagging  clues!")