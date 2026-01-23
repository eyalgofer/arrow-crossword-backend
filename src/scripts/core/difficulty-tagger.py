import pandas as pd
from wordfreq import zipf_frequency

# Load your CSV
df = pd.read_csv('train.csv')

def calculate_difficulty(row):
    answer = str(row['answer']).lower()
    clue = str(row['clue']).lower()
    
    # Base score starts at 3 (Medium)
    score = 3
    
    # --- Factor A: Word Frequency (Zipf scale) ---
    # Zipf scale: 7-8 ultra common, 5-6 very common, 3-4 common, 2-3 uncommon, <2 rare
    zipf = zipf_frequency(answer, 'en')
    
    if zipf >= 5:
        score -= 2  # Ultra common (the, and, have) / Very common (house, water)
    elif zipf >= 3.5:
        pass       # Good crossword territory - no change
    elif zipf >= 2.5:
        score += 1  # Challenging (quaint, mosaic)
    elif zipf >= 1.5:
        score += 2  # Hard (esoteric, sibilant)
    else:
        score += 3  # Obscure/unknown word
        
    # --- Factor B: Length ---
    if len(answer) <= 3:
        score -= 1
    elif len(answer) <= 4:
        pass  # Neutral for 4-letter words
    elif len(answer) > 10:
        score += 1
    elif len(answer) > 12:
        score += 2

    # --- Factor C: Tricky letters ---
    tricky_letters = set('qxzjk')
    tricky_count = sum(1 for c in answer if c in tricky_letters)
    if tricky_count >= 2:
        score += 1
    
    # Constrain score between 1 and 5
    return max(1, min(5, score))

# Apply the function
df['difficulty'] = df.apply(calculate_difficulty, axis=1)

# Save the tagged file
df.to_csv('train_difficulty.csv', index=False)

# Print distribution summary
print("Finished tagging clues!")
print("\nDifficulty distribution:")
print(df['difficulty'].value_counts().sort_index())