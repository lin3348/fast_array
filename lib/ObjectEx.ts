const OP = Object.prototype;
/**
 * 带容量大小的Object
 */
export default class ObjectEx<T> {
    //
    private _size = 0;
    private _obj: Record<string, T> = Object.create(null);

    public set(key: string | number, val: T): void {
        if (!this.has(key)) {
            this._size++;
        }

        this._obj[key] = val;
    }

    public del(key: string | number): void {
        if (this.has(key)) {
            this._size--;
            delete this._obj[key];
        }
    }

    public has(key: string | number): boolean {
        return OP.hasOwnProperty.call(this._obj, key);
    }

    public get obj(): Record<string, T> {
        return this._obj;
    }

    public get size(): number {
        return this._size;
    }
}
