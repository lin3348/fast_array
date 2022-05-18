# Ts/Js 带索引的数组结构，用于快速查找数据

 * 封装array数值，提供map缓存功能，提高数据访问速度。不知道用哪个，就优先使用 MapWithIndex 。
 * MapWithIndex： 着重优化alter速度，适用数值的经常alter()，但访问getArr()并不频繁。
 * ArrayWithIndex：着重优化getArr速度，适用数值的经常getArr()，但访问alter()并不频繁。