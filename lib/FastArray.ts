import ObjectEx from "./ObjectEx";

type TID = string | number;
/**
 * 封装array数值，提供map缓存功能，提高数据访问速度。不知道用哪个，就优先使用 MapWithIndex 。
 * MapWithIndex： 着重优化alter速度，适用数值的经常alter()，但访问getArr()并不频繁。
 * ArrayWithIndex：着重优化getArr速度，适用数值的经常getArr()，但访问alter()并不频繁。
 * 具体性能参数，查看TestArrayMap.ts文件。
 */
export class MapWithIndex<T, ID extends keyof T> {
    //
    protected readonly _object: Record<string, T>;
    //------------------------/ { [vid-key]: { [vid-value]:  { [id]: id } } } --//
    protected readonly _vids: Record<string, Record<string, ObjectEx<string>>>;
    protected readonly _idKey: string;
    protected readonly _isImmutable: boolean;
    /** 临时禁止vid map更新，用于 ArrayWithIndex.alter */
    protected _isImmutableDisable: boolean;

    // Array
    protected _size: number;
    protected _arr: T[];
    /** 数组脏标志 */
    protected _arrDirty: boolean;
    /**
     *
     * @param array 目标数组
     * @param idKey 主键
     * @param valueKeys vid-key健名称，用于构建映射
     * @param immutable vid-value是否绑定主键id，意思指的是，主键id不变的时候，vid-value值也不可能会改变；例如 id 对应的 type 一般不变
     */
    public constructor(array: readonly T[], idKey: ID, valueKeys?: (keyof T)[], immutable = true) {
        this._idKey = idKey as any;
        this._object = Object.create(null);
        this._isImmutable = immutable;
        this._isImmutableDisable = false;

        this._size = 0;
        this._arr = [];
        this._arrDirty = true;

        if (valueKeys) {
            this._vids = Object.create(null);
            valueKeys.forEach((key) => {
                this._vids[key as any] = Object.create(null);
            });
        }

        this.adds(array);
    }

    /**
     * 通过主键访问
     * @param id
     */
    public get(id: TID): T {
        return this._object[id];
    }

    /**
     * 获取数组
     */
    public getArr(): T[] {
        if (!this._arrDirty) {
            return this._arr;
        }
        const arr: T[] = [];
        for (const k in this._object) {
            arr.push(this._object[k]);
        }
        this._arrDirty = false;
        this._arr = arr;
        return arr;
    }

    /**
     * 过滤数组
     */
    public getArrFilter(filter: (v: T) => boolean): T[] {
        const arr: T[] = [];
        for (const k in this._object) {
            if (filter(this._object[k])) {
                arr.push(this._object[k]);
            }
        }
        return arr;
    }

    /**
     * 获取大小
     */
    public getSize(): number {
        return this._size;
    }

    public getObj(): Record<string, T> {
        return this._object;
    }

    /**
     * 通过value id获取目标值，若值有多个， 只会获取命中的第一个值
     * @param vidKey
     * @param vidVal
     * @returns T, undefined, null
     */
    public find(vidKey: string, vidVal: TID): T {
        const vmap = this.getVMap(vidKey, vidVal);
        if (!vmap) return null;

        for (const k in vmap.obj) {
            return this._object[k];
        }
        return null;
    }

    /**
     * 获取value id的多个值
     * @param vidKey
     * @param vidVal
     * @returns T[]
     */
    public filter(vidKey: string, vidVal: TID): T[] {
        const vmap = this.getVMap(vidKey, vidVal);
        if (!vmap) return [];

        const arr: T[] = [];
        for (const k in vmap.obj) {
            arr.push(this._object[k]);
        }
        return arr;
    }

    /**
     * 联合查找， 例如 find2("level", 2, "config", 1);
     * level，config 必须为vid；若值有多个，只会获取命中的第一个值
     * @param vidkeyVals
     * @returns T, undefined, null
     */
    // eslint-disable-next-line prettier/prettier
    public find2<K extends keyof T>(a0: K, a1: TID, b0: K, b1: TID, c0?: K, c1?: TID, d0?: K, d1?: TID): T {
        const sameVids = this.getVMap2(a0, a1, b0, b1, c0, c1, d0, d1);
        if (!sameVids) return null;

        for (const k in sameVids.obj) {
            return this._object[k];
        }
        return null;
    }

    /**
     * 联合过滤， 例如 fitler2("level", 2, "config", 1);
     * level，config 必须为vid
     * @param 参数列表
     * @returns T[]
     */
    // eslint-disable-next-line prettier/prettier
    public fitler2<K extends keyof T>(a0: K, a1: TID, b0: K, b1: TID, c0?: K, c1?: TID, d0?: K, d1?: TID): T[] {
        const sameVids = this.getVMap2(a0, a1, b0, b1, c0, c1, d0, d1);
        if (!sameVids) return [];

        const arr: T[] = [];
        for (const k in sameVids.obj) {
            arr.push(this._object[k]);
        }
        return arr;
    }

    /**
     * 联合查找 vid 对象列表， 例如 getVMap2("level", 2, "config", 1);
     * level，config 必须为vid
     * @param 参数列表
     * @returns ObjectEx / undefined
     */
    // eslint-disable-next-line prettier/prettier
    public getVMap2<K extends keyof T>(a0: K, a1: TID, b0: K, b1: TID, c0?: K, c1?: TID, d0?: K, d1?: TID): ObjectEx<string> {
        // eslint-disable-next-line prefer-rest-params
        const args = arguments;
        const vmaps: ObjectEx<string>[] = [];
        for (let i = 0; i < args.length; i += 2) {
            const vidKey = args[i];
            if (!vidKey) break;
            const vidVal = args[i + 1];
            const vmap = this.getVMap(vidKey, vidVal);
            vmap && vmaps.push(vmap);
        }

        let sameVids: ObjectEx<string>;
        if (vmaps.length < 2) return sameVids;

        vmaps.sort((a, b) => a.size - b.size);
        for (let i = 0; i < vmaps.length; i++) {
            const v = vmaps[i];
            if (!sameVids) {
                sameVids = v;
                continue;
            }
            sameVids = this._getSameKey(sameVids, v);
            if (!sameVids) {
                break;
            }
        }
        return sameVids;
    }

    /**
     * 判断联合vid内容是否为空。判断联合vid是否有数据比较有用。
     * @param vidKey
     * @param vidVal
     */
    // eslint-disable-next-line prettier/prettier
    public isVMapEmpty2<K extends keyof T>(a0: K, a1: TID, b0: K, b1: TID, c0?: K, c1?: TID, d0?: K, d1?: TID): boolean {
        const ids = this.getVMap2(a0, a1, b0, b1, c0, c1, d0, d1);
        return !ids || ids.size === 0;
    }

    /**
     * 获得vid对应的 主键id对象列表。该列表可以用于判断是否存在主键id值。
     * 相对filter再判断，效率更高，减少了数组的创建。
     * @param vidKey
     * @param vidVal
     * @returns ObjectEx / undefined
     */
    public getVMap(vidKey: string, vidVal: TID): ObjectEx<string> | undefined {
        return this._vids[vidKey][vidVal];
    }

    /**
     * 判断vid内容是否为空。判断vid是否有数据比较有用。
     * @param vidKey
     * @param vidVal
     */
    public isVMapEmpty(vidKey: string, vidVal: TID): boolean {
        const ids = this.getVMap(vidKey, vidVal);
        return !ids || ids.size === 0;
    }

    public add(newValue: T): T {
        const id = newValue[this._idKey];
        if (this._object[id]) {
            console.error(`ID：${id} 尝试新增已经存在的id值！`);
            this.alter(newValue); // 容错恢复
            return;
        }
        this._object[id] = newValue;

        // 更新vid
        if (this._vids) {
            this._addVidObject(id, newValue);
            // 绑定属性，新的值都得做一次绑定
            if (this._isImmutable) {
                for (const key in this._vids) {
                    this._bindVidWatcher(newValue, key);
                }
            }
        }
        this._size++;
        this._arrDirty = true;
        return newValue;
    }

    public remove(id: TID): T {
        const oldValue = this._object[id];
        if (!oldValue) {
            console.error(`ID：${id} 尝试删除不存在的id值！`);
            return;
        }
        delete this._object[id];

        if (this._vids) {
            this._removeVidObject(id, oldValue);
        }
        this._size--;
        this._arrDirty = true;
        return oldValue;
    }

    /**
     * 修改值，并替换整个数据引用
     * 更新newValue中id对应的值，会替换旧数据中的这个数据引用，速度较alterProp快。
     * MapWithIndex模式下 _isImmutable = false 的时候很快。
     * @param newValue
     */
    public alter(newValue: T): T {
        const id = newValue[this._idKey];
        const oldValue = this._object[id];
        if (!oldValue) {
            console.error(`修改不存在的值: ${id}`);
            this.add(newValue); // 容错恢复
            return;
        }
        if (this._isImmutable && this._vids) {
            this.remove(id);
            this.add(newValue);
        } else {
            // _isImmutable = false 下，不需要管理vid;
            this._object[id] = newValue;
        }
        this._arrDirty = true;

        return oldValue;
    }

    /**
     * MapWithIndex模式下，同 alter，区别是不会替换整个引用，只更新值，属性过多时的速度相对alter较慢
     * @param newValue 至少并必须包含id字段的值
     */
    public alterProp(newValue: T): T {
        const id = newValue[this._idKey];
        const oldValue = this._object[id];

        for (const key in newValue) {
            if (oldValue[key] !== newValue[key]) {
                oldValue[key] = newValue[key];
            }
        }
        // 不需要更新arr，因为数据引用没改
        // this._arrDirty = true;

        return oldValue;
    }

    /**
     * 仅改变某一个值
     * @param id
     * @param valueName
     * @param value
     */
    public alterOneProp(id: TID, valueName: keyof T, value: any): T {
        const oldVal = this._object[id];
        oldVal[valueName] = value;
        return oldVal;
    }

    public adds(newValue: readonly T[]): void {
        newValue.forEach((v) => this.add(v));
    }

    public removes(ids: TID[]): void {
        ids.forEach((id) => this.remove(id));
    }

    public alters(newValue: T[]): void {
        newValue.forEach((v) => this.alter(v));
    }

    /** ====================================================== */

    private _addVidObject(id: any, newValue: T): void {
        if (this._isImmutableDisable) return;

        const vidObject = this._vids;
        for (const key in vidObject) {
            const value = newValue[key];
            if (!vidObject[key][value]) {
                vidObject[key][value] = new ObjectEx(); // Object.create(null);
            }
            vidObject[key][value].set(id, String(id)); //[id] = String(id);
        }
    }

    private _removeVidObject(id: any, oldValue: T): void {
        if (this._isImmutableDisable) return;

        const vidObject = this._vids;
        for (const key in vidObject) {
            const value = oldValue[key];
            if (vidObject[key][value]) {
                // delete vidObject[key][value][id];
                vidObject[key][value].del(id);
            }
        }
    }

    private _syncVidObject(oldValue: any, newValue: any, key: string, id: any): void {
        const vidObject = this._vids;
        if (vidObject[key][oldValue]) {
            // delete vidObject[key][oldValue][id];
            vidObject[key][oldValue].del(id);
        }
        if (!vidObject[key][newValue]) {
            vidObject[key][newValue] = new ObjectEx(); // Object.create(null);
        }
        vidObject[key][newValue].set(id, String(id)); //[id] = String(id);
    }

    private _bindVidWatcher(obj: T, key: string, val?: any): void {
        let property;
        let prototype = obj;
        // 往基类查找getter setter
        do {
            property = Object.getOwnPropertyDescriptor(prototype, key);
            if (property) {
                break;
            }
            prototype = Object.getPrototypeOf(prototype);
        } while (prototype.constructor !== Object);

        if (property && property.configurable === false) {
            return;
        }

        // cater for pre-defined getter/setters
        const getter = property && property.get;
        const setter = property && property.set;
        if ((!getter || setter) && arguments.length === 2) {
            val = obj[key];
        }

        Object.defineProperty(obj, key, {
            set: (newVal) => {
                const value = getter ? getter.call(obj) : val;
                if (newVal === value || (newVal !== newVal && value !== value)) {
                    return;
                }
                if (setter) {
                    setter.call(obj, newVal);
                } else {
                    val = newVal;
                }
                this._syncVidObject(value, obj[key], key, obj[this._idKey]);
            },
            get: () => {
                const value = getter ? getter.call(obj) : val;
                return value;
            },
        });
    }

    private _getSameKey(o1: ObjectEx<string>, o2: ObjectEx<string>): any {
        let ret: ObjectEx<string>;
        for (const k1 in o1.obj) {
            if (o2.has(k1)) {
                ret = ret || new ObjectEx<string>();
                ret.set(k1, o1.obj[k1]);
            }
        }
        return ret;
    }
}

/**
 * 参考 MapWithIndex
 */
export class ArrayWithIndex<T, ID extends keyof T> extends MapWithIndex<T, ID> {
    //
    public getArr(): T[] {
        return this._arr;
    }

    public getArrFilter(filter: (v: T) => boolean): T[] {
        return this._arr.filter(filter);
    }

    public add(newValue: T): T {
        super.add(newValue);
        this._arr.push(newValue);
        return newValue;
    }

    public remove(id: TID): T {
        const oldValue = super.remove(id);
        for (let i = 0; i < this._arr.length; i++) {
            const v = this._arr[i];
            if (v[this._idKey] === id) {
                this._arr.splice(i, 1);
                return oldValue;
            }
        }
        return oldValue;
    }

    /**
     * ArrayWithIndex模式下，因为要同步数组，alter时会产生add, remove数组的操作，速度上不一定会比alterProp快
     * @param newValue
     */
    public alter(newValue: T): T {
        const id = newValue[this._idKey];
        const oldValue = this._object[id];

        // 目标vid字段不可改时，不更新 remove、add 的 vid
        if (!this._isImmutable) {
            this._isImmutableDisable = true;
        }
        this.remove(id);
        this.add(newValue);

        this._isImmutableDisable = false;

        return oldValue;
    }

    /**
     * ArrayWithIndex模式下，这个可能更快
     * @param newValue
     */
    public alterProp(newValue: T): T {
        const oldValue = super.alterProp(newValue);
        return oldValue;
    }
}
