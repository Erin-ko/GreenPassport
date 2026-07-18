import math

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """計算地球上兩個經緯度點的球面距離 (單位：公里)"""
    # 將經緯度轉換為弧度
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    # Haversine 半正矢公式計算
    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         (math.sin(delta_lambda / 2.0) ** 2))
    
    # 防止因浮點數精度導致 asin 傳入超界值
    a = min(1.0, max(0.0, a))
    
    c = 2.0 * math.asin(math.sqrt(a))
    
    # 地球半徑 (約 6371 公里)
    r = 6371.0
    return r * c

def get_distance_text(distance_km: float) -> str:
    """將公里距離轉換為安全模糊相對距離描述"""
    if distance_km < 0.1:
        return "距離 100m 以內"
    elif distance_km < 1.0:
        # 模糊化至整百公尺，例如 0.34km -> 300m 或 400m
        m = int(round(distance_km * 10)) * 100
        if m == 0:
            return "距離 100m 以內"
        return f"距離約 {m}m"
    else:
        # 大於 1 公里，顯示小數點後 1 位
        return f"距離 {round(distance_km, 1)}km"
