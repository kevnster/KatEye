# Driving Behavior Classifier

## Overview
This project builds a classification model to identify four distinct driving behaviors using attitude sensor data, specifically combining gyroscope and accelerometer readings.

## Dataset Overview
* **Source:** 
    * [DRIVING BEHAVIOR DATASET (MPU6050)]("https://data.mendeley.com/datasets/jj3tw8kj6h/3")
    * [DRIVING EVENTS (smartphone sensors)]("https://doi.org/10.7910/DVN/F5JZHF")
* **Shape:** 1,114 rows × 12 columns
* **Features:** 6 sensor channels (GyroX, GyroY, GyroZ, AccX, AccY, AccZ), alongside DriverID, TaskID, and timestamps.
* **Data Quality:** Complete dataset with no missing values and no duplicates.
* **Sampling Rate:** ~1 Hz (approximately 1 sample per wall-clock second).
* **Target Classes:** 4 driving-event classes.
  * **Balance:** Fairly balanced (1.6x imbalance ratio). 
  * **Distribution:** Class 3 is the largest (31.4%), and Class 4 is the smallest (20.1%).

## Sensor Insights & EDA
Initial exploratory data analysis reveals the following mechanical and statistical behaviors:
* **High Variance & Noise:** `GyroZ` exhibits the widest range (std = 12.0) and is the noisiest channel (51 identified outliers).
* **Correlations:**
  * *Strong Positive:* `GyroZ` ↔ `AccY` (r = 0.82). These channels are heavily coupled, likely representing yaw-related motion.
  * *Moderate Negative:* `GyroX` ↔ `GyroZ` (r = -0.46) and `GyroX` ↔ `AccY` (r = -0.42).
* **Low Signal Value:** `AccZ` hovers around -1.0 (acting primarily as the gravity component) and exhibits low variance, suggesting it may contribute little discriminative signal.
* **Outliers:** 89 rows (8% of the data) have at least one channel with a z-score magnitude > 3 (`|z| > 3`). Robust scaling or clipping will be required during preprocessing.

## Baseline Architecture Plan
The initial architecture plan explores a 1-Dimensional Convolutional Neural Network (CNN) configured as follows:

`Conv1D` → `ReLU` → `Conv1D` → `ReLU` → `MaxPool` → `Dropout` → `Flatten` → `Dense` → `ReLU` → `Dropout` → `Dense` → `Softmax`

---

## Architectural Consideration: The Windowing Problem
While the 1D CNN is the baseline plan, the **~1 Hz sampling rate** presents a significant challenge for raw-signal deep learning. 

At this frequency, a standard 2-second time window captures only **2 samples**. This is far too short for a `Conv1D` layer to extract meaningful temporal patterns. 

**Pivot/Current Strategy:** The repository includes pre-computed feature files (spanning window sizes of 4 to 20, with 61 engineered features each). This suggests that the optimal workflow for this dataset relies on **statistical feature engineering over larger sliding windows**, rather than feeding raw, low-frequency sensor signals directly into a CNN.

## References

- Amidi Afshine, Amidi Shervine. Convolutional Neural Networks. https://stanford.edu/~shervine/teaching/cs-230/cheatsheet-convolutional-neural-networks/

- Goh, Vik Tor; Jamal Mohd Lokman, Eilham Hakimie; Yap, Timothy Tzen Vun; Ng, Hu, 2021, "Driving Events", https://doi.org/10.7910/DVN/F5JZHF, Harvard Dataverse, V1

- Jamal Mohd Lokman EH, Goh VT, Yap TTV and Ng H. Driving event recognition using machine learning and smartphones [version 2; peer review: 2 approved]. F1000Research 2022, 11:57 (https://doi.org/10.12688/f1000research.73134.2)

- Yuksel, Asim Sinan; Atmaca, Şerafettin (2021), “Driving Behavior Dataset”, Mendeley Data, V3, doi: 10.17632/jj3tw8kj6h.3

