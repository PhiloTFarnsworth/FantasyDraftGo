package server

func Init() {
	r := NewRouter()
	r.Run(":8000") // listen and serve on local:8000
}
