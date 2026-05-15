input
Conv1D
ReLU
Conv1D
ReLU
Pooling
Dropout

Flatten
Dense
ReLU
Dropout
Dense
Softmax

output

Architecture
Input (7, 6) - Conv1D(16, kernel=3, same) + ReLU - Conv1D(32, kernel=3, same) + ReLU - MaxPool1D(2) - Dropout(0.3) - Flatten - Dense(32) + ReLU - Dropout(0.4) - Dense(4) + Softmax
