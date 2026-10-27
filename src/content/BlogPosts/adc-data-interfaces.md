---
title: ADC 数据输出接口：架构与设计
date: '2026-10-26'
excerpt: 梳理 ADC 到 FPGA、ASIC 或 MCU 的数据链路，覆盖吞吐量、接口架构、时序和噪声耦合。
tags:
- 学习记录
- adc
- digital-interface
---

# ADC 数据输出接口：架构与设计

> [!abstract] 核心定位
> 梳理 ADC 到 FPGA、ASIC 或 MCU 的数据链路，覆盖吞吐量、接口架构、时序和噪声耦合。

---

> 适用对象：ADC 芯片到 FPGA/ASIC/MCU/采集板之间的数据输出接口。 本文重点讨论 ADC **数字输出数据链路**，不展开模拟输入、参考电压、采样时钟接口。

---

## 目录

- **2026 新增专题**：见文末扩展篇章，含新增推导、文献与配图

1. 接口基础：作用、吞吐量与总体分类
   - 1.1 ADC 数据输出接口的作用
   - 1.2 ADC 输出数据率的基本计算
   - 1.3 ADC 数据输出接口总体分类
2. 低速与中高速并行/差分接口
   - 2.1 SPI / I2C 数据输出接口
   - 2.2 并行 CMOS 输出接口
   - 2.3 DDR CMOS 输出接口
   - 2.4 并行 LVDS 输出接口
   - 2.5 Serial LVDS / Serialized LVDS 输出接口
   - 2.6 SLVS / 低摆幅差分输出接口
3. 高速串行接口：CML、JESD204B 与 JESD204C
   - 3.1 CML / SerDes 输出接口
   - 3.2 JESD204B 输出接口
   - 3.3 JESD204C 输出接口
4. 数据格式、时钟与对齐
   - 4.1 数据格式：输出码如何表示
   - 4.2 数据输出接口中的时钟和对齐信号
5. 接口选型与自研 ADC 输出策略
   - 5.1 接口选择：按 ADC 规格快速判断
   - 5.2 接口选择：按设计目标判断
   - 5.3 自研 ADC 芯片常用输出策略
   - 5.4 对 12-bit 800 MS/s ADC 的接口建议
6. 调试、测试、版图与封装
   - 6.1 数据输出接口调试流程
   - 6.2 常见 test pattern
   - 6.3 接口问题与现象对应表
   - 6.4 版图和封装层面的注意点
7. 综合对比、最终建议与参考资料
   - 7.1 对比总结
   - 7.2 最终选型建议
   - 7.3 参考资料

## 1. 接口基础：作用、吞吐量与总体分类

![01_adc_data_output_link](/images/blog/learning-notes/adc-data-interfaces/01_adc_data_output_link.svg)

*图：ADC 量化结果经数据组织和接口链路送至 FPGA/ASIC；时钟、帧与同步信号需按所选协议确定。*

### 1.1 ADC 数据输出接口的作用

ADC 完成采样和量化后，需要把数字码稳定地送到外部逻辑器件。这个外部器件可能是：

- MCU；

- FPGA；

- ASIC；

- DSP；

- 数据采集卡；

- 后端数字处理 SoC。

ADC 数据输出接口需要解决几个核心问题：

1. **吞吐量是否足够** ADC 的采样率、分辨率、通道数决定了原始数据率。

2. **引脚数是否可接受** 并行接口简单但引脚多，串行接口复杂但引脚少。

3. **时序是否容易捕获** 高速接口通常需要 source-synchronous clock、frame clock、training pattern 或 SerDes CDR。

4. **数字 IO 对模拟性能的干扰是否可控** 大量 CMOS IO 同时翻转会引入 ground bounce、substrate noise 和 supply noise，影响 ADC 的 SNDR、SFDR 和 spur。

5. **是否需要多通道同步和确定性延迟** 雷达、MIMO、相控阵、仪器仪表常常需要多 ADC 或多通道数据对齐。

---

### 1.2 ADC 输出数据率的基本计算

ADC 输出接口选型首先看数据率。

#### 单通道原始 payload

对于单通道 ADC：

Payload = Fs × Nout

其中：

- `Fs`：采样率；

- `Nout`：每个 sample 输出位宽，可能等于 ADC 分辨率，也可能补齐到 8/12/14/16 bit。

例如：

12-bit, 800 MS/s ADC  
如果输出补齐为 16 bit：  
​  
Payload = 800M × 16 = 12.8 Gb/s

注意：这只是有效数据 payload，不包含编码、控制位、frame、training、8b/10b 或 64b/66b 开销。

---

#### 多通道 ADC

对于多通道 ADC：

Total Payload = Fs × Nout × M

其中 `M` 是 converter/channel 数。

例如：

4-channel, 14-bit, 250 MS/s ADC  
若每个 sample 补齐到 16 bit：  
​  
Total Payload = 250M × 16 × 4 = 16 Gb/s

---

#### JESD204B lane rate 估算

JESD204B 使用 8b/10b 编码，编码效率为 80%。常用估算式：

Lane Rate = Fs × M × N′ × 10 / (8 × L)

其中：

- `Fs`：每个 converter 的采样率；

- `M`：converter 数；

- `N′`：实际传输 sample 宽度；

- `L`：JESD lane 数；

- `10/8`：8b/10b 编码开销。

例如：

Fs = 800 MS/s  
M = 1  
N′ = 16 bit  
L = 2  
​  
Lane Rate = 800M × 1 × 16 × 10 / (8 × 2)  
          = 8 Gb/s/lane

这个配置对 JESD204B 通常是合理的。

---

### 1.3 ADC 数据输出接口总体分类

按复杂度和数据率可以大致分为：

|接口类型|典型数据率等级|引脚数|接收复杂度|多通道同步能力|适合场景|
|---|---|---|---|---|---|
|SPI / I2C 数据输出|低|很少|低|弱|低速 SAR / ΔΣ / sensor ADC|
|并行 CMOS|低到中|多|低|一般|中低速 ADC、片内测试输出|
|DDR CMOS|中|中等|中|一般|中速 ADC、低成本系统|
|并行 LVDS|中高速|多|中|一般|高速 ADC、板级采集|
|Serial LVDS|高|较少|中高|一般|高速 ADC 到 FPGA|
|SLVS / 低摆幅差分接口|中高速到高速|较少|中高|一般|低功耗 ASIC/图像传感/定制芯片|
|CML / SerDes|高|少|高|取决于协议|高速串行物理层|
|JESD204B|很高|少|高|强|高速 ADC/DAC，FPGA/ASIC 接收|
|JESD204C|更高|少|很高|强|RF sampling ADC/DAC，超高速多通道系统|

---

## 2. 低速与中高速并行/差分接口

### 2.1 SPI / I2C 数据输出接口

#### 基本形式

低速 ADC 常使用 SPI 或 I2C 直接读出转换结果。

典型 SPI 信号：

CS  
SCLK  
SDO  
SDI  
DRDY / BUSY

典型读数流程：

1. ADC 完成一次转换  
2. DRDY 拉低或 BUSY 释放  
3. MCU/FPGA 通过 SPI 时钟读取数据  
4. 进入下一次转换

#### 优点

- 引脚少；

- 接口简单；

- MCU 兼容性好；

- 适合低功耗和低成本应用；

- PCB 设计简单。

#### 缺点

- 数据率有限；

- 不适合高速 ADC；

- 采样数据通常不是连续高速流，而是“转换完成后读取”；

- 多通道同步能力有限。

#### 适用范围

适合：

Hz ~ 几 MS/s 级 ADC  
低速 SAR ADC  
ΔΣ ADC  
传感器 ADC  
MCU 数据采集

不适合：

数十 MS/s 以上高速 ADC  
GS/s 级 ADC  
多通道同步高速采集

---

### 2.2 并行 CMOS 输出接口

#### 基本形式

并行 CMOS 是最直观的数据输出方式。以 12-bit ADC 为例：

D[11:0]  
DCLK  
DRDY / VALID  
OR

每个 bit 一根数字线，外部逻辑在 DCLK 边沿采样数据。

典型时序：

        ┌─┐ ┌─┐ ┌─┐  
DCLK ___│ │_│ │_│ │___  

D[11:0] === Code[n] === Code[n+1] === Code[n+2] ===

#### 优点

- 架构简单；

- 延迟低；

- 不需要 SerDes；

- FPGA/ASIC 接收逻辑简单；

- 适合芯片验证和中低速输出。

#### 缺点

1. **引脚数多** 12 bit ADC 至少需要 12 根数据线，加上时钟、valid、overrange 等信号。

2. **同时翻转噪声大** CMOS 输出从 0 到 VDDIO 全摆幅翻转，多个 bit 同时切换会产生较大电源/地噪声。

3. **对 ADC 模拟部分干扰强** 数字 IO 噪声可能通过封装、电源、衬底、地线耦合到采样前端和比较器。

4. **高速时 skew 难控制** 数据线越多，PCB 等长和接收端时序窗口越难保证。

5. **EMI 较强** 大摆幅、单端、大量同步翻转，容易产生辐射和串扰。

#### 对 ADC 性能的影响

并行 CMOS 在高速 ADC 中可能造成：

SFDR 下降  
spur 增多  
噪声底抬高  
时序错误导致码字跳变  
数字回灌造成 code-dependent distortion

#### 适用范围

适合：

低速/中速 ADC  
片内测试输出  
原型验证  
小规模通道数  
板级距离短

不适合：

高速高精度 ADC  
多通道 GS/s ADC  
对 SFDR 很敏感的 ADC  
长距离板级传输

---

### 2.3 DDR CMOS 输出接口

#### 基本概念

DDR CMOS 在 DCLK 上升沿和下降沿都传输数据：

上升沿：传输一部分 bit  
下降沿：传输另一部分 bit

例如 12-bit ADC 可以用 6 根数据线 DDR 输出：

D[5:0]  
DCLK  

DCLK rising edge  → D[5:0] = Code[11:6]  
DCLK falling edge → D[5:0] = Code[5:0]

#### 优点

- 相比普通并行 CMOS，数据线数量可以减半；

- 接口复杂度仍低于 LVDS/JESD；

- 延迟较低；

- 适合中速 ADC。

#### 缺点

- 接收端需要 DDR input cell；

- 上下沿时序都要满足 setup/hold；

- DCLK duty cycle distortion 会影响采样裕量；

- 高速下仍然存在 CMOS 大摆幅噪声问题；

- PCB skew 和 FPGA 内部 routing delay 需要仔细约束。

#### 适用范围

适合：

中速 ADC  
引脚数量有限但不想引入 LVDS/JESD 的系统  
FPGA/ASIC 近距离接收

不适合：

几百 MS/s 以上高精度 ADC  
长距离传输  
多通道高同步系统

---

### 2.4 并行 LVDS 输出接口

#### 基本概念

LVDS 是高速 ADC 经典输出接口。它使用低摆幅差分信号传输数据。典型 LVDS 差分摆幅约为数百毫伏，常见约 350 mV 量级。

典型并行 LVDS ADC 输出：

D0P/D0N  
D1P/D1N  
...  
D13P/D13N  
DCLKP/DCLKN  
FCOP/FCON  
ORP/ORN

#### 与 CMOS 的区别

|项目|CMOS|LVDS|
|---|---|---|
|信号形式|单端|差分|
|摆幅|大，接近 VDDIO|小，约数百 mV|
|EMI|较大|较小|
|共模噪声抑制|差|好|
|同时翻转噪声|较大|较小|
|引脚数|每 bit 1 根线|每 bit 1 对线|
|高速能力|中等|更强|

#### 优点

- 低摆幅，开关噪声小；

- 差分传输，共模噪声抑制好；

- EMI 比 CMOS 小；

- 适合中高速 ADC；

- 对模拟前端干扰相对较小。

#### 缺点

- 每个数据 bit 需要一对差分线，引脚和 PCB routing 仍然较多；

- 需要终端匹配，一般为 100 Ω 差分端接；

- 多 lane skew 需要控制；

- FPGA 端需要 LVDS IO 和合适的输入延迟校准；

- 多通道系统中线数仍然很可观。

#### 工程注意点

1. **100 Ω 差分阻抗控制** LVDS 差分对通常按 100 Ω 差分阻抗设计。

2. **DCLK 与数据线等长** DCLK 是 source-synchronous 捕获参考，DCLK 与数据线 skew 直接影响采样窗口。

3. **FCO / frame clock 用于字边界对齐** 并行 LVDS 或 serialized LVDS 中，FCO 可帮助 FPGA 判断一个 sample 的边界。

4. **接收端使用 IDELAY/ISERDES** 在 FPGA 中常通过 input delay 和 ISERDES 调整采样点。

5. **优先用 test pattern 调试** 比如 ramp、checkerboard、固定码、PRBS，用于验证 bit order、lane order 和采样边沿。

---

### 2.5 Serial LVDS / Serialized LVDS 输出接口

#### 基本概念

Serial LVDS 是把并行 ADC 数据先串行化，再通过较少的 LVDS lane 输出。

例如一个 14-bit ADC 不再使用 14 对 LVDS 数据线，而可能使用：

1~4 对 LVDS data lane  
1 对 bit clock  
1 对 frame clock

典型结构：

ADC core  
  ↓  
parallel data  
  ↓  
serializer  
  ↓  
LVDS data lane + bit clock + frame clock  
  ↓  
FPGA ISERDES  
  ↓  
parallel sample recovery

#### 典型信号

DATA0±  
DATA1±  
...  
DCLK±   或 bit clock  
FCO±    或 frame clock

#### 优点

- 比并行 LVDS 显著减少引脚；

- 比 JESD204B 简单；

- 不需要完整 JESD 协议栈；

- 延迟较低；

- 适合 ADC 到 FPGA 的中高速连接。

#### 缺点

- FPGA 端需要反串行化；

- 需要 bit alignment 和 word/frame alignment；

- DCLK、FCO、DATA 之间 skew 要严格控制；

- 多 lane 的 bit slip 和 lane alignment 要处理；

- 数据率上限低于高速 SerDes/JESD；

- 缺乏 JESD204B/C 那样标准化的多器件确定性延迟机制。

#### 接收端常见处理流程

1. 接收 LVDS bit clock  
2. 使用 IDELAY 调整 DATA 采样点  
3. 使用 ISERDES 反串行化  
4. 根据 FCO 找到 word boundary  
5. 执行 bit slip  
6. 重组 sample  
7. 检查 test pattern  
8. 切换真实 ADC 数据

#### 常见错误

bit 顺序反了：MSB/LSB first 配置错误  
采样边沿错了：rising/falling edge 选择错误  
字边界错了：FCO 没有正确使用  
lane 顺序错了：FPGA pin mapping 与 ADC 输出表不一致  
offset binary / two's complement 理解错  
DCLK 相位不合适：setup/hold 不满足

---

### 2.6 SLVS / 低摆幅差分输出接口

#### 基本概念

SLVS 即 Scalable Low-Voltage Signaling，是一种低电压、低摆幅差分接口。它常见于图像传感器、低功耗高速芯片和定制 ASIC 接口中，也可以作为 ADC 数据输出接口的参考选择。

相对于 LVDS，SLVS 往往强调：

更低电源电压  
更低摆幅  
更低功耗  
更适合先进 CMOS 工艺

#### 优点

- 摆幅更低，功耗更小；

- 适合低电压先进工艺；

- 差分传输，抗共模噪声能力好；

- 适合片间短距离高速数据输出。

#### 缺点

- 生态不如 LVDS/JESD 普遍；

- FPGA 直接支持情况取决于器件 IO 标准；

- 标准化程度和互操作性需要谨慎确认；

- 需要自定义接收端或专用 PHY 时，设计复杂度增加。

#### 适用场景

适合：

低功耗高速 ADC 原型  
ASIC-to-ASIC 接口  
短距离板级连接  
片上/封装内定制接口

不适合：

希望直接连接通用 FPGA 且无需额外适配的系统  
需要强标准互操作性的产品级接口

---

## 3. 高速串行接口：CML、JESD204B 与 JESD204C

### 3.1 CML / SerDes 输出接口

#### 基本概念

CML，即 Current Mode Logic，是高速串行接口中常见的物理层输出形式。JESD204B/C 这类高速串行接口的 lane 物理层通常可理解为 CML/SerDes 风格。

典型结构：

parallel ADC data  
  ↓  
serializer  
  ↓  
8b/10b or 64b/66b encoder  
  ↓  
CML high-speed differential lane  
  ↓  
FPGA transceiver

#### 优点

- 适合多 Gb/s 甚至更高速率；

- 差分、低摆幅，信号完整性好；

- 引脚数少；

- 适合长一些的 PCB 走线和高速连接器；

- 可配合 CDR 恢复时钟。

#### 缺点

- SerDes 设计复杂；

- 功耗较高；

- 需要 PLL、CDR、均衡、预加重；

- 需要高速封装和 PCB 设计；

- 自研芯片中开发难度远高于 CMOS/LVDS。

---

### 3.2 JESD204B 输出接口

#### 基本定位

JESD204B 是高速 ADC/DAC 与 FPGA/ASIC 之间的标准化高速串行接口。它的核心目标是：

减少引脚数  
提高数据吞吐量  
支持多 lane  
支持多器件同步  
支持 deterministic latency

JESD204B 使用 8b/10b 编码，典型最高 lane rate 为 12.5 Gb/s 级别。

#### 典型信号

ADC 到 FPGA 的 JESD204B 系统通常包含：

`JES$D_TX0$±`  
`JES$D_TX1$±`  
...  
Device Clock±  
SYSREF±  
SYNC~  
SPI  
RESET

其中：

- `JES$D_TXx$±`：高速串行数据 lane；

- `Device Clock`：ADC 和 JESD 链路参考时钟；

- `SYSREF`：Subclass 1 中用于 LMFC 对齐；

- `SYNC~`：FPGA/RX 发给 ADC/TX 的同步请求；

- `SPI`：配置 ADC JESD 模式、lane 数、test pattern 等。

#### 协议分层

JESD204B 可以分为：

Transport Layer：sample 如何打包成 frame/lane  
Link Layer：CGS、ILAS、lane alignment、scrambling、8b/10b  
Physical Layer：SerDes、电气层、CDR、均衡

#### 关键参数

|参数|含义|
|---|---|
|L|lanes per link，lane 数|
|M|converters per device，converter 数|
|F|octets per frame per lane|
|S|samples per converter per frame|
|K|frames per multiframe|
|N|ADC 原始分辨率|
|N′|实际传输 sample 宽度|
|CS|control bits per sample|
|HD|high-density mode|
|Subclass|0/1/2，同步与确定性延迟模式|

#### 链路建立流程

JESD204B 通常经历：

1. CGS：Code Group Synchronization  
2. ILAS：Initial Lane Alignment Sequence  
3. User Data：正常采样数据传输

##### CGS

RX 拉低 SYNC~  
TX 发送 K28.5 /K/ 字符  
RX 完成 comma alignment  
RX 释放 SYNC~

CGS 解决的是 8b/10b 串行流的基本字边界同步问题。

##### ILAS

ILAS 用于：

多 lane 对齐  
发送 link configuration  
验证 L/M/F/S/K/N/N′ 等参数  
建立 multiframe 边界

##### User Data

ILAS 完成后进入真实 ADC 数据传输。若开启 scrambling，一般在 user data 阶段生效。

#### Subclass

|Subclass|特点|是否支持确定性延迟|典型使用|
|---|---|---|---|
|Subclass 0|不使用 SYSREF|否|单器件、无需固定延迟|
|Subclass 1|使用 SYSREF 对齐 LMFC|是|最常用，高速多通道|
|Subclass 2|基于 SYNC~ 定时|是|较少使用|

高速多通道 ADC 系统通常优先选择 **Subclass 1**。

#### 优点

- 大幅减少引脚数；

- 支持高吞吐；

- 标准化程度高；

- FPGA IP 支持成熟；

- 支持多 lane；

- 支持多器件同步和确定性延迟；

- 适合高速多通道 ADC。

#### 缺点

- 协议复杂；

- FPGA 端配置复杂；

- SerDes 功耗较高；

- 延迟大于 LVDS/CMOS；

- 对 clock、SYSREF、lane rate、reset sequence 要求高；

- bring-up 难度明显高于 LVDS。

#### 适用场景

适合：

几百 MS/s 到 GS/s ADC  
多通道高速 ADC  
RF sampling ADC  
雷达、MIMO、相控阵  
需要确定性延迟的系统  
FPGA/ASIC 后端

不适合：

低速 ADC  
简单 MCU 系统  
仅用于 ADC core 早期论文验证的小芯片  
资源和功耗极度受限的接口

---

### 3.3 JESD204C 输出接口

#### 与 JESD204B 的主要区别

JESD204C 是 JESD204B 的后续版本，主要面向更高数据率和更高编码效率。

|项目|JESD204B|JESD204C|
|---|---|---|
|常见编码|8b/10b|8b/10b、64b/66b、64b/80b|
|编码效率|80%|64b/66b 约 96.97%|
|目标速率|多 Gb/s 到 12.5 Gb/s 级别|更高速 SerDes|
|延迟同步|支持|支持并增强|
|适用|高速 ADC/DAC|超高速 RF ADC/DAC|

#### 优点

- 编码效率更高；

- 同样 payload 下所需 lane rate 更低；

- 更适合超高速 ADC/DAC；

- 支持更高 lane rate；

- 更适合 RF sampling、多通道宽带系统。

#### 缺点

- FPGA/ASIC IP 更复杂；

- bring-up 难度更高；

- 对 SerDes、时钟、PCB 要求更高；

- 工程生态相对 JESD204B 更复杂。

#### 适用场景

适合：

>1 GS/s 多通道 ADC  
RF sampling ADC  
宽带通信收发器  
高速 DAC  
JESD204B lane rate 不够的场景

---

## 4. 数据格式、时钟与对齐

### 4.1 数据格式：输出码如何表示

ADC 输出接口不仅要传输 bit，还要明确数据格式。

常见格式：

|格式|英文|零输入码|适用|
|---|---|---|---|
|直二进制|Straight Binary|中间码或 0，取决于输入类型|单极性 ADC|
|偏移二进制|Offset Binary|Mid-code|差分 ADC 常见|
|二进制补码|Two's Complement|0|DSP/FFT 常用|

#### Offset Binary

以 12 bit 差分 ADC 为例：

负满量程 → 0000_0000_0000  
零输入   → 1000_0000_0000  
正满量程 → 1111_1111_1111

#### Two's Complement

以 12 bit 为例：

负满量程 → 1000_0000_0000  
零输入   → 0000_0000_0000  
正满量程 → 0111_1111_1111

#### 常见错误

如果 FPGA 或 MATLAB 后处理把 offset binary 当成 two's complement，可能出现：

严重 DC 偏移  
FFT 结果异常  
幅度计算错误  
正负半周翻转  
谐波和 spur 看起来不正常

转换关系：

`tw$o_complement$_code = offse$t_binary$_code XOR 1000...000`

即翻转 MSB。

---

### 4.2 数据输出接口中的时钟和对齐信号

#### DCLK / Bit Clock

DCLK 是数据输出时钟，常用于 CMOS、DDR CMOS、LVDS 和 serial LVDS。

作用：

告诉 FPGA/ASIC 在哪个边沿采样数据

#### FCO / Frame Clock

FCO 用于指示 sample 或 word 的边界，常见于 serial LVDS。

作用：

帮助接收端知道串行 bit stream 从哪里开始组成一个 sample

#### VALID / DRDY

VALID 或 DRDY 表示数据有效。

低速 ADC 中：

DRDY = 一次转换完成，可以读取数据

高速流式 ADC 中：

VALID = 当前并行数据拍有效

#### OR / Over Range

OR 表示输入过量程。

常见用途：

提示输入超过 ADC 满量程  
辅助 AGC  
标记无效 sample  
后端算法做 clipping 检测

#### SYNC~

JESD204B/C 中使用，通常由接收端控制发送端重新同步。

#### SYSREF

JESD204B/C Subclass 1 中使用，用于对齐 LMFC，实现确定性延迟。

---

## 5. 接口选型与自研 ADC 输出策略

### 5.1 接口选择：按 ADC 规格快速判断

#### 低速 ADC

采样率：Hz ~ 几 MS/s  
推荐：SPI / I2C

典型应用：

传感器  
电池管理  
低速数据采集  
MCU 系统

#### 中速 ADC

采样率：几 MS/s ~ 数十 MS/s  
推荐：并行 CMOS / DDR CMOS / 简单 LVDS

典型应用：

仪表  
工业采集  
低成本 FPGA 系统

#### 高速 ADC

采样率：几十 MS/s ~ 几百 MS/s  
推荐：LVDS / Serial LVDS

典型应用：

通信 IF 采样  
超声  
高速仪器  
多通道数据采集

#### GS/s ADC

采样率：GS/s 级  
推荐：JESD204B / JESD204C

典型应用：

RF sampling  
雷达  
宽带通信  
MIMO  
高速示波器  
相控阵

---

### 5.2 接口选择：按设计目标判断

|设计目标|推荐接口|
|---|---|
|最简单、最低成本|SPI / 并行 CMOS|
|最低延迟|并行 CMOS / LVDS|
|较低数字噪声|LVDS / SLVS|
|最少引脚|Serial LVDS / JESD204B/C|
|高吞吐|JESD204B/C|
|多通道同步|JESD204B/C Subclass 1|
|论文芯片测试|片内 demux + 低速并行 / LVDS|
|产品级高速 ADC|JESD204B/C|
|FPGA 快速接收|LVDS / JESD，取决于 FPGA 资源|
|MCU 接收|SPI / I2C|

---

### 5.3 自研 ADC 芯片常用输出策略

对于自研高速 ADC，尤其是论文芯片，未必一开始就上 JESD204B/C。更常见的思路是：

ADC core 高速输出  
  ↓  
片内 demux 降速  
  ↓  
低速并行 CMOS 或 LVDS 输出  
  ↓  
FPGA/采集板捕获

#### 片内 demux

例如：

800 MS/s × 12 bit  
→ 8 路 100 MS/s × 12 bit

或者：

800 MS/s × 12 bit  
→ 16 路 50 MS/s × 12 bit

优点：

- 降低 pad 输出速率；

- 降低 FPGA 捕获难度；

- 避免自研高速 SerDes；

- 更适合 ADC core 验证。

缺点：

- 输出总线变宽；

- pad 数增加；

- 片内 demux 和时钟树需要设计；

- 数字 IO 同时翻转噪声仍需控制。

#### 片上 SRAM / FIFO

另一种论文芯片常用方案：

高速 ADC 数据先写入片上 SRAM  
低速读出 SRAM

优点：

- 避免实时高速输出接口；

- 方便测试 ADC core 极限性能；

- 对封装和 PCB 要求降低。

缺点：

- 只能捕获有限长度数据；

- SRAM 占面积；

- 需要测试控制逻辑；

- 不适合实时连续应用。

#### 低速 scan / debug bus

适合校准码、状态码、低速观测，不适合完整采样流。

---

### 5.4 对 12-bit 800 MS/s ADC 的接口建议

假设 ADC 规格：

分辨率：12 bit  
采样率：800 MS/s  
单通道  
输出补齐：16 bit

原始 payload：

800M × 16 = 12.8 Gb/s

#### 并行 CMOS

如果直接 16-bit 并行输出：

16 根数据线 + DCLK + VALID/OR  
每根数据线 800 Mb/s 级别

问题：

CMOS IO 噪声很大  
FPGA 捕获困难  
pad/封装/PCB 压力大  
不推荐作为最终高速实时输出

#### DDR CMOS

如果 8-bit DDR：

8 根数据线  
DCLK = 800 MHz 或相关高速时钟

问题：

DCLK 频率高  
setup/hold 窗口小  
CMOS 噪声仍然明显

也不太推荐。

#### LVDS / Serial LVDS

比较适合作为论文测试接口：

片内 demux 到 8×100 MS/s 或 16×50 MS/s  
再用 LVDS/CMOS 输出

或者：

使用若干 serial LVDS lane 实时输出

优点：

比 JESD 简单  
比 CMOS 噪声低  
FPGA 接收可实现  
适合论文芯片和实验室采集

#### JESD204B

若使用 JESD204B：

N′ = 16  
L = 2  
Lane Rate = 8 Gb/s/lane

这是合理配置。

优点：

引脚少  
协议标准  
适合产品级接口

缺点：

SerDes + JESD 协议复杂  
功耗和面积增加  
论文 ADC core 验证成本高

#### 推荐结论

如果目标是 **论文芯片验证 ADC core**：

优先：片内 demux + LVDS/低速 CMOS  
备选：片上 SRAM + 低速读出  
不建议：一开始自研 JESD204B

如果目标是 **产品级高速 ADC**：

优先：JESD204B 或 JESD204C

---

## 6. 调试、测试、版图与封装

### 6.1 数据输出接口调试流程

#### 通用调试顺序

1. 确认电源和复位  
2. 确认采样时钟  
3. 确认输出接口时钟  
4. 确认 SPI 配置  
5. 打开固定 test pattern  
6. 检查 bit order  
7. 检查 word alignment  
8. 检查 lane mapping  
9. 检查数据格式  
10. 切换 ramp pattern  
11. 切换 PRBS 或 checkerboard  
12. 最后输入真实正弦波做 FFT

#### 不建议一开始做 FFT

因为 FFT 异常可能来自：

模拟输入失真  
采样时钟 jitter  
reference settling  
输出接口 bit 错位  
数据格式错误  
FPGA 解包错误  
sample 顺序错误  
lane 对齐错误

应先用 digital test pattern 排除接口问题。

---

### 6.2 常见 test pattern

高速 ADC 常见测试码型：

|Pattern|用途|
|---|---|
|固定全 0|检查静态通路|
|固定全 1|检查 bit stuck|
|0xAAAA / 0x5555|检查相邻 bit 翻转|
|checkerboard|检查高速翻转能力|
|ramp|检查 bit order、sample order|
|PN / PRBS|检查误码率和链路稳定性|
|custom pattern|检查特定 lane/bit mapping|
|sine wave|最后验证 ADC 动态性能|

---

### 6.3 接口问题与现象对应表

|现象|可能原因|
|---|---|
|输出全 0 或全 1|ADC 未工作、复位未释放、接口未使能、SPI 配置错|
|码值随机跳变|DCLK 相位错误、setup/hold 不满足、接收边沿错|
|ramp 不连续|bit order 错、lane mapping 错、sample 丢失|
|FFT 出现强 DC|offset binary / two's complement 处理错|
|FFT 镜像或频率异常|sample 顺序错、降采样/重排错误|
|偶发错误|时序裕量不足、jitter、串扰、电源噪声|
|JESD SYNC~ 反复拉低|CGS/ILAS/user data 错误、lane rate 或参数不匹配|
|JESD CGS 不过|SerDes、lane polarity、refclk、K28.5 检测问题|
|JESD ILAS 不过|L/M/F/S/K/N/N′、scrambling、HD、lane mapping 不一致|

---

### 6.4 版图和封装层面的注意点

#### CMOS 输出

- 避免大量 CMOS IO 靠近模拟输入；

- 数字 IO 电源与模拟电源隔离；

- 加强 VDDIO/VSSIO 去耦；

- 控制 simultaneous switching output；

- 必要时降低 drive strength；

- 输出码可采用 gray coding 或随机化降低同时翻转，但会增加后端解码。

#### LVDS/SLVS 输出

- 差分对 100 Ω 阻抗控制；

- P/N 严格等长；

- lane 间 skew 控制；

- 远离采样时钟和模拟输入；

- 合理端接；

- 保持返回路径连续；

- 避免跨分割平面走线。

#### JESD/SerDes 输出

- 高速差分线阻抗和插损控制；

- 关注 via stub、connector loss、return loss；

- 需要 AC coupling 时注意电容位置和规格；

- 使用参考平面连续的高速布线；

- 关注 SerDes PLL 电源噪声；

- 合理使用 TX pre-emphasis 和 RX equalization；

- 进行眼图和 BER 验证。

---

## 7. 综合对比、最终建议与参考资料

### 7.1 对比总结

|接口|优点|缺点|推荐程度|
|---|---|---|---|
|SPI/I2C|简单、引脚少|太慢|低速 ADC 首选|
|并行 CMOS|简单、低延迟|引脚多、噪声大|中低速/测试|
|DDR CMOS|引脚少一些|时序更紧、仍有噪声|中速可用|
|并行 LVDS|噪声低、速度高|差分对多|高速 ADC 常用|
|Serial LVDS|引脚较少、比 JESD 简单|需要反串行和对齐|高速原型推荐|
|SLVS|低功耗、低摆幅|生态和 FPGA 支持有限|定制芯片可考虑|
|CML/SerDes|高速、少引脚|PHY 复杂|高端接口基础|
|JESD204B|标准、高速、同步强|协议复杂、功耗高|产品级高速推荐|
|JESD204C|更高速、更高效率|更复杂|超高速 RF 推荐|

---

### 7.2 最终选型建议

#### 低速 ADC

SPI / I2C

#### 中速 ADC

并行 CMOS  
DDR CMOS  
简单 LVDS

#### 高速 ADC

LVDS  
Serial LVDS

#### 超高速 / 多通道 ADC

JESD204B  
JESD204C

#### 自研论文 ADC

推荐优先级：

1. 片内 demux + 低速并行输出  
2. 片内 demux + LVDS 输出  
3. 片上 SRAM + 低速读出  
4. Serial LVDS  
5. JESD204B/C

理由：

论文芯片的核心通常是 ADC 架构、采样前端、CDAC、比较器、校准算法和动态性能。  
如果过早引入 JESD204B/C，会显著增加 SerDes、协议、时钟、FPGA IP 和 PCB 调试复杂度。

#### 产品级高速 ADC

推荐优先级：

1. JESD204B/C  
2. Serial LVDS  
3. 并行 LVDS  
4. DDR CMOS

理由：

产品级系统更关注引脚数、标准化、可扩展性、多通道同步和 FPGA/ASIC 生态。

---

### 7.3 参考资料

1. Analog Devices, _High Speed Converter Survival Guide: Digital Data Outputs_. [https://www.analog.com/en/resources/technical-articles/high-speed-converter-survival-guide-digital-data-outputs.html](https://www.analog.com/en/resources/technical-articles/high-speed-converter-survival-guide-digital-data-outputs.html)

2. Analog Devices, _Interfacing FPGAs to an ADC's Digital Data Output_. [https://www.analog.com/en/resources/technical-articles/interfacing-fpgas-to-an-adcs-digital-data-output.html](https://www.analog.com/en/resources/technical-articles/interfacing-fpgas-to-an-adcs-digital-data-output.html)

3. Texas Instruments, _Understanding Serial LVDS Capture in High-Speed ADCs_, SBAA205. [https://www.ti.com/lit/pdf/sbaa205](https://www.ti.com/lit/pdf/sbaa205)

4. Texas Instruments, _JESD204 Technology_. [https://www.ti.com/technologies/jesd204.html](https://www.ti.com/technologies/jesd204.html)

5. Analog Devices, _JESD204B Survival Guide_. [https://www.analog.com/media/en/technical-documentation/technical-articles/JESD204B-Survival-Guide.pdf](https://www.analog.com/media/en/technical-documentation/technical-articles/JESD204B-Survival-Guide.pdf)

6. Analog Devices, _JESD204B Subclasses—Part 1: An Introduction to JESD204B Subclasses and Deterministic Latency_. [https://www.analog.com/en/resources/technical-articles/jesd204b-subclasses-part1-an-introduction-to-jesd204b-subclasses-and-deterministic-latency.html](https://www.analog.com/en/resources/technical-articles/jesd204b-subclasses-part1-an-introduction-to-jesd204b-subclasses-and-deterministic-latency.html)

7. Texas Instruments, _What to Know About the Differences Between JESD204B and JESD204C_, SBAA517. [https://www.ti.com/lit/sbaa517](https://www.ti.com/lit/sbaa517)

8. Texas Instruments, _System Design Considerations when Upgrading from JESD204B to JESD204C_, SBAA402. [https://www.ti.com/lit/sbaa402](https://www.ti.com/lit/sbaa402)

9. Texas Instruments, _LVDS Owner's Manual Design Guide_, SNLA187. [https://www.ti.com/lit/ug/snla187/snla187.pdf](https://www.ti.com/lit/ug/snla187/snla187.pdf)

10. Sony Semiconductor Solutions, _High-speed Interface SLVS-EC_. [https://www.sony-semicon.com/en/technology/is/slvsec.html](https://www.sony-semicon.com/en/technology/is/slvsec.html)

## 2026 深化：从 ADC 原始码率到 JESD204C / 片上 Capture（新增）

> [!tip] 重要区分
> 物理层（CML/LVDS/CMOS/SLVS）、链路编码（8b/10b、64b/66b）、运输层 mapping（samples/converters/lanes）和采集机制（SRAM/FIFO/decimation）位于**不同层级**。JESD204B/C 是串行传输标准及 framing/link/同步规范，并非某种模拟 ADC 架构。根据公开资料，**JESD204D 已在 2023 年公布**，这里重点仍是 B/C，因为原笔记的目标为 ADC→FPGA 测试。[I1]

### I1. 先算 payload，再算编码、分 lane 与效率

对 ADC 原始数码，若 `M` 个 converter，每个每秒 `Fs` 样本，实际输出/运输层每样本 `N'` bit，则：

$$R_{\rm payload}=M\times F_s\times N'.$$

对 JESD204B 8b/10b 编码，理想只考虑线路编码开销时 `R_lane=R_payload×(10/8)/L`；对 JESD204C 64b/66b 模式为 `R_lane≈R_payload×(66/64)/L`，仍须按具体 frame mapping/padding、控制/同步开销和收发器余量修正。**不是所有 JESD204C 链接都一定采用 64b/66b**；它还包含其他工作模式。不要把协议理论峰值/PHY 极限直接用作可持续有效数据率。

假定一颗 `20 GS/s × 12 bit` ADC，若每样本运输为 16 bit，则 `R_payload=320 Gb/s`；若采用 8 个 JESD204C 64b/66b lanes，不计其它 overhead，理论 `R_lane≈41.25 Gb/s`，已超出许多常规收发器或特定 JESD204C 实现的能力，说明**从一开始就必须引入更多 lanes、片上筛选/降采样、数据分时输出或更高代际 PHY**。这是预算示例，非某芯片已实现规格。

![2026_05_专项机制图](/images/blog/learning-notes/adc-data-interfaces/2026_05_专项机制图.svg)

*原创专项机制示意；图中比例、相位和结构仅用于说明原理，不代表实际芯片晶体管级拓扑。*

![2026_01_接口分层](/images/blog/learning-notes/adc-data-interfaces/2026_01_接口分层.svg)

### I2. 片上 SRAM Capture、降采样和全速输出三选一吗？

不是。可同时设置 test modes：完整 20 GS/s 全速输出测试 PHY；一部分验证通道以可控 decimation rate 输出用于静态调试；全通道信号通过片上 Capture SRAM/FIFO 写入，随后慢速读出做高精度 FFT。三个方案互补，但它们的**保真条件不同**：

|路径|最直接用途|上限与风险|是否等于真实全速测试|
|---|---|---|---|
|全速物理链路|实时连续波形/BER/宽带测量|pad、SERDES、封装、板级功耗和 EMI|是（若无丢失）|
|固定抽取/decimation|低引脚数功能调试|未经抗混叠滤波会频率折叠；抽取不保留所有原始样本|否，除非明确测量带宽/重建条件|
|片上 SRAM/FIFO Capture|连续短窗频谱/错误码抓取|深度、写端口功耗、触发对齐、CDC、数据下载时长|短记录可，不能无限连续|

对片上 capture，设置 32 个子 ADC、每路 625 MS/s，每次记录 `K` 个样本，则 `Memory_bits=32×K×N_out`。如 `K=256, N_out=12`，需 `98,304 bit` 纯 payload；如果包含校准旁路码、时间标志、触发元数据和冗余位，则需额外预算。注意采样相位对齐、写地址映射与重构顺序必须清楚，否则即使单通道各自正确，合并后也会出现周期性 spur。

![2026_02_三种数据采集](/images/blog/learning-notes/adc-data-interfaces/2026_02_三种数据采集.svg)

### I3. JESD204B/C Subclass 1 的同步不是“所有 lane 同时到达”

通过 SYSREF 建立确定性时基，使器件间 frame/multiframe 或 extended multiblock 边界可对齐；RX 仍需弹性缓冲、lane alignment 与 deterministic latency 管理。设计时分别检查 `device clock`、`SYSREF` 采样条件、`SYNC~` 复位行为、`LMFC/LEMC`、FPGA transceiver CDR 与帧解码。两次 power-cycle 后输出某个字是否在同一 FPGA 时钟出现，才是系统级 deterministic-latency 的关键验证项，不能只看 PRBS 误码率。[I2][I3]

### I4. 测试计划：码型、数字噪声串扰和时钟域交叉

1. 码型：固定 0/1、walking-one、计数器、伪随机 PRBS、常数通道与真实 ADC 输出，先验证 bit mapping/极性，再验证时序和接口 BER。
2. CDC：异步 FIFO 需要独立时钟域的读写指针跨域与 full/empty 保护；不可把多 bit 总线简单用两个 DFF 同步。
3. 电源完整性：同时翻转的 CMOS bus/pad drive 会导致 supply bounce、衬底耦合，需在芯片顶层加真实 IO model 并对比输出 PHY on/off 下的模拟 FFT。
4. 封装：高速差分线的 return path、DC blocking、AC coupling、ESD/封装寄生与 100 Ω 差分端接均须按所用器件接口文档，不可由 “CML” 一词推断实际电压幅度或阻抗。

![2026_03_接口验证链](/images/blog/learning-notes/adc-data-interfaces/2026_03_接口验证链.svg)

### I5. 标准/厂商文档（新增并更新版本）

- [I1] JEDEC JESD204B / JESD204C.01 / JESD204D（标准原文以 JEDEC 授权版本为准）；版本关系与修订索引可参阅 [JESD204 技术入口](https://www.jesd204b.com/docs.html)（第三方汇编，用作导航，不代替标准）。
- [I2] Texas Instruments, *Understanding JESD204B*, [官方技术资料 SNAU140](https://www.ti.com/lit/pdf/snau140)（Subclass 0/1/2、SYSREF/SYNC 与数据组织）。
- [I3] Intel, *F-Tile JESD204B IP Deterministic Latency Implementation Guidelines*, 2024, [官方说明](https://www.intel.com/content/www/us/en/docs/programmable/723907/24-1-2-2-0/ip-deterministic-latency-implementation.html)。
- [I4] Texas Instruments, *What to Know About the Differences Between JESD204B and JESD204C*, [SBAA517](https://www.ti.com/lit/sbaa517)。
- [I5] IEEE Std 1241-2023, *Terminology and Test Methods for Analog-to-Digital Converters*, [标准主页](https://standards.ieee.org/ieee/1241/6797/)（用于定义 ENOB/SNDR/采集测试规范）。
- [I6] B. Murmann, *ADC Performance Survey 1997–2026*, <https://github.com/bmurmann/ADC-survey>（比较公开高速 ADC 采样率、功耗时明确数据输出条件）。

**图示边界**：三张新增 SVG 为分层系统图、模式比较与验证路径图；不是 JESD 官方时序图。若后续拿到对应 FPGA IP/ADC 芯片的手册，需再补入原文中的 link training、SYSREF/SYNC 和 transport mapping 实际时序图。

### 定量分析图（理论/指定参数示意）

![2026_04_理论参数曲线](/images/blog/learning-notes/adc-data-interfaces/2026_04_理论参数曲线.png)

> 上图为数学模型/显式参数下计算的示意曲线，不是论文测量，也不是 TSMC 28 nm PDK 提取结果。实际结论需结合文中定义、完整寄生与时序验证。

---