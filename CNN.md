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


Architecture (from plan):
    Input (7, 6)
    - Conv1D(16, kernel=3, same) + ReLU
    - Conv1D(32, kernel=3, same) + ReLU
    - MaxPool1D(2)
    - Dropout(0.3)
    - Flatten
    - Dense(32) + ReLU
    - Dropout(0.4)
    - Dense(4) + Softmax
 
Design rationale:
    - 16/32 filters (not 64/128) ;  keeps model under 10KB for ESP32-S3
    - kernel_size=3 ; receptive field covers 3 seconds at 1 Hz
    - Single MaxPool(2) > (7,32) > (3,32), can't pool more at this length
    - Dropout 0.3/0.4 > aggressive regularization for tiny dataset
    - ~5,108 total parameters > ~5-10 KB quantized INT8
